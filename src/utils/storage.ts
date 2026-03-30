import * as vscode from 'vscode';
import { Stock } from '../models/stock';

export class StorageService {
    private context: vscode.ExtensionContext;
    private readonly STOCK_LIST_KEY = 'trader.stockList';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * 获取已保存的股票列表
     */
    async getStockList(): Promise<Stock[]> {
        const stocks = this.context.globalState.get<Stock[]>(this.STOCK_LIST_KEY);
        return stocks || [];
    }

    /**
     * 保存股票列表
     */
    async saveStockList(stocks: Stock[]): Promise<void> {
        await this.context.globalState.update(this.STOCK_LIST_KEY, stocks);
    }

    /**
     * 添加股票
     */
    async addStock(stock: Stock): Promise<void> {
        const stocks = await this.getStockList();
        // 检查是否已存在
        if (!stocks.find(s => s.code === stock.code)) {
            stock.order = stocks.length;
            stocks.push(stock);
            await this.saveStockList(stocks);
        }
    }

    /**
     * 删除股票
     */
    async removeStock(code: string): Promise<void> {
        const stocks = await this.getStockList();
        const filtered = stocks.filter(s => s.code !== code);
        // 重新排序
        filtered.forEach((s, index) => {
            s.order = index;
        });
        await this.saveStockList(filtered);
    }

    /**
     * 清空所有股票
     */
    async clearAll(): Promise<void> {
        await this.saveStockList([]);
    }

    /**
     * 更新股票顺序
     */
    async updateOrder(stocks: Stock[]): Promise<void> {
        stocks.forEach((s, index) => {
            s.order = index;
        });
        await this.saveStockList(stocks);
    }

    /**
     * 置顶股票
     */
    async pinStock(code: string): Promise<void> {
        const stocks = await this.getStockList();
        const index = stocks.findIndex(s => s.code === code);
        if (index > -1) {
            const [stock] = stocks.splice(index, 1);
            stock.pinned = !stock.pinned;
            if (stock.pinned) {
                // 置顶：移动到数组开头
                stocks.unshift(stock);
            } else {
                // 取消置顶：移动到非置顶区域
                const pinnedCount = stocks.filter(s => s.pinned).length;
                stocks.splice(pinnedCount, 0, stock);
            }
            stocks.forEach((s, i) => {
                s.order = i;
            });
            await this.saveStockList(stocks);
        }
    }

    /**
     * 排序股票
     */
    async sortStocks(sortType: string): Promise<void> {
        const stocks = await this.getStockList();
        
        // 分离置顶和非置顶的股票
        const pinnedStocks = stocks.filter(s => s.pinned);
        const unpinnedStocks = stocks.filter(s => !s.pinned);
        
        // 只对非置顶的股票排序
        switch (sortType) {
            case 'changeDesc':
                unpinnedStocks.sort((a, b) => b.changePercent - a.changePercent);
                break;
            case 'changeAsc':
                unpinnedStocks.sort((a, b) => a.changePercent - b.changePercent);
                break;
            case 'priceDesc':
                unpinnedStocks.sort((a, b) => b.price - a.price);
                break;
            case 'priceAsc':
                unpinnedStocks.sort((a, b) => a.price - b.price);
                break;
            case 'default':
            default:
                unpinnedStocks.sort((a, b) => (a.order || 0) - (b.order || 0));
                break;
        }
        
        // 合并：置顶的在前，非置顶的在后
        const sortedStocks = [...pinnedStocks, ...unpinnedStocks];
        
        // 更新顺序
        sortedStocks.forEach((s, i) => {
            s.order = i;
        });
        
        await this.saveStockList(sortedStocks);
    }
}
