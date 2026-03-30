import * as vscode from 'vscode';
import { StockApiService } from './api/stockApi';
import { StorageService } from './utils/storage';
import { SectorsProvider, IndexProvider, StockListProvider, USStockProvider, StockDragAndDropController } from './providers/TreeProviders';

/**
 * 判断当前是否在A股交易时间
 * 交易时间：工作日 9:30-11:30, 13:00-15:00
 */
function isTradingTime(): boolean {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // 周六日不交易
    if (day === 0 || day === 6) {
        return false;
    }
    
    // 转换为分钟数便于比较
    const timeInMinutes = hour * 60 + minute;
    
    // 上午交易时间 9:30-11:30
    if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes <= 11 * 60 + 30) {
        return true;
    }
    
    // 下午交易时间 13:00-15:00
    if (timeInMinutes >= 13 * 60 && timeInMinutes <= 15 * 60) {
        return true;
    }
    
    return false;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Trader extension is now active!');

    const apiService = new StockApiService();
    const storageService = new StorageService(context);

    // 创建数据提供者
    const sectorsProvider = new SectorsProvider(apiService);
    const indexProvider = new IndexProvider(apiService);
    const stockListProvider = new StockListProvider(apiService, storageService);
    const usStockProvider = new USStockProvider(apiService);

    // 注册树视图（按显示顺序创建，国内指数优先）
    const indexView = vscode.window.createTreeView('traderMainIndex', {
        treeDataProvider: indexProvider,
        showCollapseAll: false
    });

    const sectorsView = vscode.window.createTreeView('traderSectors', {
        treeDataProvider: sectorsProvider,
        showCollapseAll: false
    });

    // 创建股票列表拖拽控制器
    const stockDragAndDropController = new StockDragAndDropController(storageService, stockListProvider);

    const stockListView = vscode.window.createTreeView('traderStockList', {
        treeDataProvider: stockListProvider,
        showCollapseAll: false,
        dragAndDropController: stockDragAndDropController
    });

    const usStockView = vscode.window.createTreeView('traderUSTech', {
        treeDataProvider: usStockProvider,
        showCollapseAll: false
    });

    // 刷新所有数据
    const refreshAllData = async () => {
        await Promise.all([
            sectorsProvider.updateData(),
            indexProvider.updateData(),
            usStockProvider.updateData(),
            stockListProvider.updateData()
        ]);
    };

    // 注册刷新命令
    const refreshCommand = vscode.commands.registerCommand('trader.refresh', async () => {
        await refreshAllData();
        vscode.window.showInformationMessage('数据已刷新');
    });

    // 注册添加股票命令（支持单个和批量）
    const addStockCommand = vscode.commands.registerCommand('trader.addStock', async () => {
        const input = await vscode.window.showInputBox({
            prompt: '请输入股票代码或名称（支持批量，用逗号、空格或换行分隔）',
            placeHolder: '例如: 600519 或 茅台, 平安银行'
        });

        if (!input) {
            return;
        }

        // 分割输入（支持逗号、空格、换行）
        const keywords = input
            .split(/[,\s\n]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (keywords.length === 0) {
            return;
        }

        // 单个关键词的情况
        if (keywords.length === 1) {
            const keyword = keywords[0];
            const results = await apiService.searchStock(keyword);

            if (results.length === 0) {
                vscode.window.showWarningMessage('未找到相关股票');
                return;
            }

            // 如果只有一个结果，直接添加
            if (results.length === 1) {
                await storageService.addStock(results[0]);
                await stockListProvider.updateData();
                vscode.window.showInformationMessage(`已添加: ${results[0].name}`);
                return;
            }

            // 多个结果，让用户选择
            const items = results.map(s => ({
                label: s.name,
                description: s.code
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '选择要添加的股票'
            });

            if (selected) {
                const stock = results.find(s => s.code === selected.description);
                if (stock) {
                    await storageService.addStock(stock);
                    await stockListProvider.updateData();
                    vscode.window.showInformationMessage(`已添加: ${stock.name}`);
                }
            }
            return;
        }

        // 多个关键词的情况（批量添加）
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "正在搜索股票...",
            cancellable: false
        }, async (progress) => {
            const allResults: { keyword: string; stocks: any[] }[] = [];

            // 批量搜索每个关键词
            for (let i = 0; i < keywords.length; i++) {
                const keyword = keywords[i];
                progress.report({
                    message: `搜索 ${keyword} (${i + 1}/${keywords.length})`
                });

                const results = await apiService.searchStock(keyword);
                allResults.push({ keyword, stocks: results });
            }

            // 收集所有搜索结果
            const selectableItems: { label: string; description: string; stock: any }[] = [];

            for (const { keyword, stocks } of allResults) {
                if (stocks.length === 0) {
                    continue;
                }

                // 为每个搜索结果创建选项
                for (const stock of stocks) {
                    selectableItems.push({
                        label: stock.name,
                        description: stock.code,
                        stock: stock
                    });
                }
            }

            if (selectableItems.length === 0) {
                vscode.window.showWarningMessage('未找到任何相关股票');
                return;
            }

            // 让用户多选
            const selected = await vscode.window.showQuickPick(selectableItems, {
                placeHolder: `找到 ${selectableItems.length} 个结果，选择要添加的股票（可多选）`,
                canPickMany: true
            });

            if (!selected || selected.length === 0) {
                return;
            }

            // 批量添加
            let addedCount = 0;
            for (const item of selected) {
                try {
                    await storageService.addStock(item.stock);
                    addedCount++;
                } catch (error) {
                    console.error(`添加 ${item.stock.name} 失败:`, error);
                }
            }

            await stockListProvider.updateData();
            vscode.window.showInformationMessage(`成功添加 ${addedCount} 只股票`);
        });
    });

    // 注册删除股票命令
    const removeStockCommand = vscode.commands.registerCommand('trader.removeStock', async (item: any) => {
        if (item && item.stock) {
            await storageService.removeStock(item.stock.code);
            await stockListProvider.updateData();
            vscode.window.showInformationMessage(`已移除: ${item.stock.name}`);
        }
    });

    // 注册清空命令
    const clearAllCommand = vscode.commands.registerCommand('trader.clearAll', async () => {
        const confirm = await vscode.window.showWarningMessage(
            '确定要清空所有关注吗？',
            '确定',
            '取消'
        );
        if (confirm === '确定') {
            await storageService.clearAll();
            await stockListProvider.updateData();
            vscode.window.showInformationMessage('已清空所有关注');
        }
    });

    // 注册置顶命令
    const pinStockCommand = vscode.commands.registerCommand('trader.pinStock', async (item: any) => {
        if (item && item.stock) {
            await storageService.pinStock(item.stock.code);
            await stockListProvider.updateData();
        }
    });

    // 注册取消置顶命令
    const unpinStockCommand = vscode.commands.registerCommand('trader.unpinStock', async (item: any) => {
        if (item && item.stock) {
            await storageService.pinStock(item.stock.code);
            await stockListProvider.updateData();
        }
    });

    // 注册排序命令
    const sortStocksCommand = vscode.commands.registerCommand('trader.sortStocks', async () => {
        const options = [
            { label: '$(arrow-down) 按涨跌幅降序', description: '涨幅从高到低', value: 'changeDesc' },
            { label: '$(arrow-up) 按涨跌幅升序', description: '跌幅从低到高', value: 'changeAsc' },
            { label: '$(arrow-down) 按价格降序', description: '价格从高到低', value: 'priceDesc' },
            { label: '$(arrow-up) 按价格升序', description: '价格从低到高', value: 'priceAsc' },
            { label: '$(list-unordered) 按添加时间', description: '恢复默认顺序', value: 'default' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择排序方式'
        });

        if (selected) {
            await storageService.sortStocks(selected.value);
            await stockListProvider.updateData();
            vscode.window.showInformationMessage('排序完成');
        }
    });

    context.subscriptions.push(
        indexView,
        sectorsView,
        stockListView,
        usStockView,
        refreshCommand,
        addStockCommand,
        removeStockCommand,
        clearAllCommand,
        pinStockCommand,
        unpinStockCommand,
        sortStocksCommand
    );

    // 初始化数据
    refreshAllData();

    // 只在交易时间自动刷新
    let currentInterval: NodeJS.Timeout | null = null;
    
    const setupInterval = () => {
        const tradingTime = isTradingTime();
        
        // 清除旧的定时器
        if (currentInterval) {
            clearInterval(currentInterval);
            currentInterval = null;
        }
        
        // 只在交易时间设置定时器（3秒刷新）
        if (tradingTime) {
            currentInterval = setInterval(() => {
                refreshAllData();
                // 每次刷新后检查是否还在交易时间
                if (!isTradingTime()) {
                    setupInterval(); // 退出交易时间，停止自动刷新
                }
            }, 3000);
            console.log('进入交易时间，启动实时刷新 (3秒)');
        } else {
            console.log('非交易时间，停止自动刷新');
        }
    };
    
    // 启动
    setupInterval();

    // 每分钟检查一次交易时间状态
    const checkInterval = setInterval(() => {
        setupInterval();
    }, 60000);

    context.subscriptions.push(
        { dispose: () => { if (currentInterval) clearInterval(currentInterval); } },
        { dispose: () => clearInterval(checkInterval) }
    );
}

export function deactivate() {}
