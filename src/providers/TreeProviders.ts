import * as vscode from 'vscode';
import { Stock, Sector, Index, GlobalIndex, MarketSentiment } from '../models/stock';
import { StockApiService } from '../api/stockApi';
import { StorageService } from '../utils/storage';

/**
 * 板块树节点（扁平列表，带行业标签）
 */
export class SectorItem extends vscode.TreeItem {
    constructor(
        public readonly sector: Sector,
        public readonly category: string
    ) {
        super(sector.name, vscode.TreeItemCollapsibleState.None);
        // 显示：行业标签 + 涨跌幅
        this.description = `[${category}] ${sector.changePercent >= 0 ? '+' : ''}${sector.changePercent.toFixed(2)}%`;
        this.tooltip = `${sector.name}\n行业: ${category}\n涨跌幅: ${sector.changePercent.toFixed(2)}%\n成交额: ${this.formatAmount(sector.amount)}`;
        this.contextValue = 'sector';
    }

    private formatAmount(amount: number): string {
        if (!amount) return '-';
        if (amount >= 100000000) {
            return (amount / 100000000).toFixed(2) + '亿';
        } else if (amount >= 10000) {
            return (amount / 10000).toFixed(2) + '万';
        }
        return amount.toFixed(0);
    }
}

/**
 * 指数树节点
 */
export class IndexItem extends vscode.TreeItem {
    constructor(
        public readonly index: Index
    ) {
        super(index.name, vscode.TreeItemCollapsibleState.None);
        this.description = `${index.price.toFixed(2)} ${index.changePercent >= 0 ? '+' : ''}${index.changePercent.toFixed(2)}%`;
        this.tooltip = `${index.name}\n点位: ${index.price.toFixed(2)}\n涨跌幅: ${index.changePercent.toFixed(2)}%`;
        this.contextValue = 'index';
    }
}

/**
 * 全球指数树节点
 */
export class GlobalIndexItem extends vscode.TreeItem {
    constructor(
        public readonly globalIndex: GlobalIndex
    ) {
        super(globalIndex.name, vscode.TreeItemCollapsibleState.None);
        this.description = `${globalIndex.price.toFixed(2)} ${globalIndex.changePercent >= 0 ? '+' : ''}${globalIndex.changePercent.toFixed(2)}%`;
        this.tooltip = `${globalIndex.name} (${globalIndex.country})\n点位: ${globalIndex.price.toFixed(2)}\n涨跌幅: ${globalIndex.changePercent.toFixed(2)}%`;
        this.contextValue = 'globalIndex';
    }
}

/**
 * 股票树节点
 */
export class StockItem extends vscode.TreeItem {
    constructor(
        public readonly stock: Stock
    ) {
        super(stock.name || stock.code, vscode.TreeItemCollapsibleState.None);
        this.description = `${stock.price ? stock.price.toFixed(2) : '-'} ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%`;
        this.tooltip = `${stock.name} (${stock.code})\n价格: ${stock.price ? stock.price.toFixed(2) : '-'}\n涨跌幅: ${stock.changePercent ? stock.changePercent.toFixed(2) : '0.00'}%`;
        this.contextValue = stock.pinned ? 'pinnedStock' : 'stock';
        this.iconPath = stock.pinned ? new vscode.ThemeIcon('star-full') : undefined;
    }
}

/**
 * 板块数据提供者（扁平列表）
 */
export class SectorsProvider implements vscode.TreeDataProvider<SectorItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SectorItem | undefined | null | void> = new vscode.EventEmitter<SectorItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SectorItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sectors: { sector: Sector; category: string }[] = [];

    constructor(private apiService: StockApiService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SectorItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SectorItem): Thenable<SectorItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.sectors.map(s => new SectorItem(s.sector, s.category)));
    }

    async updateData(): Promise<void> {
        const sectorData = await this.apiService.getSectorRanking();
        
        // 为每个板块添加分类标签，并按涨跌幅排序（降序：涨幅大的在前）
        this.sectors = sectorData
            .map(sector => ({
                sector,
                category: this.categorizeSector(sector.name)
            }))
            .sort((a, b) => b.sector.changePercent - a.sector.changePercent);
        
        this.refresh();
    }

    /**
     * 根据板块名称分类
     */
    private categorizeSector(name: string): string {
        if (name.includes('半导体') || name.includes('芯片') || name.includes('5G') || 
            name.includes('人工智能') || name.includes('云计算') || name.includes('大数据') ||
            name.includes('电子')) {
            return '科技';
        }
        if (name.includes('光伏') || name.includes('新能源') || name.includes('电池') || 
            name.includes('储能') || name.includes('风电')) {
            return '新能源';
        }
        if (name.includes('酒') || name.includes('医疗') || name.includes('医药') || 
            name.includes('家电') || name.includes('食品') || name.includes('消费')) {
            return '消费';
        }
        if (name.includes('有色') || name.includes('稀土') || name.includes('钢铁') || 
            name.includes('煤炭') || name.includes('化工') || name.includes('建材') ||
            name.includes('造纸')) {
            return '周期';
        }
        if (name.includes('证券') || name.includes('银行') || name.includes('保险') ||
            name.includes('金融')) {
            return '金融';
        }
        if (name.includes('军工') || name.includes('国防')) {
            return '军工';
        }
        if (name.includes('传媒') || name.includes('基建') || name.includes('农业') ||
            name.includes('养殖')) {
            return '其他';
        }
        return '综合';
    }
}

/**
 * 国内指数数据提供者
 */
export class IndexProvider implements vscode.TreeDataProvider<IndexItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<IndexItem | undefined | null | void> = new vscode.EventEmitter<IndexItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<IndexItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private indices: Index[] = [];

    constructor(private apiService: StockApiService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: IndexItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: IndexItem): Thenable<IndexItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.indices.map(i => new IndexItem(i)));
    }

    async updateData(): Promise<void> {
        this.indices = await this.apiService.getMainIndex();
        this.refresh();
    }
}

/**
 * 全球指数数据提供者
 */
export class GlobalIndexProvider implements vscode.TreeDataProvider<GlobalIndexItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GlobalIndexItem | undefined | null | void> = new vscode.EventEmitter<GlobalIndexItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GlobalIndexItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private indices: GlobalIndex[] = [];

    constructor(private apiService: StockApiService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GlobalIndexItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GlobalIndexItem): Thenable<GlobalIndexItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.indices.map(i => new GlobalIndexItem(i)));
    }

    async updateData(): Promise<void> {
        this.indices = await this.apiService.getGlobalIndex();
        this.refresh();
    }
}

/**
 * 股票列表数据提供者
 */
export class StockListProvider implements vscode.TreeDataProvider<StockItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StockItem | undefined | null | void> = new vscode.EventEmitter<StockItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StockItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private stocks: Stock[] = [];

    constructor(
        private apiService: StockApiService,
        private storageService: StorageService
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StockItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: StockItem): Thenable<StockItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        if (this.stocks.length === 0) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.stocks.map(s => new StockItem(s)));
    }

    async updateData(): Promise<void> {
        const savedStocks = await this.storageService.getStockList();
        if (savedStocks.length === 0) {
            this.stocks = [];
            this.refresh();
            return;
        }

        // 先按 order 字段排序
        savedStocks.sort((a, b) => (a.order || 0) - (b.order || 0));

        const codes = savedStocks.map(s => s.code);
        const stockMap = await this.apiService.getStockPrice(codes);

        this.stocks = savedStocks.map(saved => {
            const realtime = stockMap.get(saved.code);
            return {
                ...saved,
                ...(realtime || {}),
                pinned: saved.pinned,
                order: saved.order
            };
        });

        this.refresh();
    }
}

/**
 * 股票拖拽控制器
 */
export class StockDragAndDropController implements vscode.TreeDragAndDropController<StockItem> {
    readonly dragMimeTypes = ['application/vnd.code.tree.traderStockList'];
    readonly dropMimeTypes = ['application/vnd.code.tree.traderStockList'];

    constructor(
        private storageService: StorageService,
        private stockListProvider: StockListProvider
    ) {}

    handleDrag(source: readonly StockItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // 将拖拽的股票代码序列化
        const draggedCodes = source.map(item => item.stock.code);
        dataTransfer.set('application/vnd.code.tree.traderStockList', new vscode.DataTransferItem(draggedCodes));
    }

    async handleDrop(target: StockItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.traderStockList');
        if (!transferItem) {
            return;
        }

        const draggedCodes = transferItem.value as string[];
        if (!draggedCodes || draggedCodes.length === 0) {
            return;
        }

        // 获取当前股票列表
        const stocks = await this.storageService.getStockList();
        
        // 找到目标位置
        let targetIndex = -1;
        if (target) {
            targetIndex = stocks.findIndex(s => s.code === target.stock.code);
        }

        // 如果没有目标（拖拽到空白区域），则不处理
        if (targetIndex === -1 && target !== undefined) {
            return;
        }

        // 如果拖拽到空白区域，则放到最后
        if (target === undefined) {
            targetIndex = stocks.length;
        }

        // 移动股票到新位置
        for (const code of draggedCodes) {
            const currentIndex = stocks.findIndex(s => s.code === code);
            if (currentIndex === -1) {
                continue;
            }

            // 如果拖拽的是同一位置，跳过
            if (currentIndex === targetIndex) {
                continue;
            }

            // 移除原位置的股票
            const [stock] = stocks.splice(currentIndex, 1);

            // 调整目标索引（如果原位置在目标位置之前）
            if (currentIndex < targetIndex) {
                targetIndex--;
            }

            // 插入到新位置
            stocks.splice(targetIndex, 0, stock);
            targetIndex++;
        }

        // 更新所有股票的顺序
        stocks.forEach((s, i) => {
            s.order = i;
        });

        // 保存并刷新
        await this.storageService.saveStockList(stocks);
        await this.stockListProvider.updateData();
    }
}

/**
 * 美股指数节点
 */
export class USIndexItem extends vscode.TreeItem {
    constructor(
        public readonly index: GlobalIndex
    ) {
        super(index.name, vscode.TreeItemCollapsibleState.None);
        this.description = `${index.price.toFixed(2)} ${index.changePercent >= 0 ? '+' : ''}${index.changePercent.toFixed(2)}%`;
        this.tooltip = `${index.name}\n点位: ${index.price.toFixed(2)}\n涨跌幅: ${index.changePercent.toFixed(2)}%`;
        this.contextValue = 'usIndex';
        this.iconPath = new vscode.ThemeIcon('graph');
    }
}

/**
 * 美股市场数据提供者（指数 + 科技七姐妹 + 用户自定义）
 */
export class USStockProvider implements vscode.TreeDataProvider<USIndexItem | StockItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<USIndexItem | StockItem | undefined | null | void> = new vscode.EventEmitter<USIndexItem | StockItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<USIndexItem | StockItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private indices: GlobalIndex[] = [];
    private stocks: Stock[] = [];

    constructor(private apiService: StockApiService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: USIndexItem | StockItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: USIndexItem | StockItem): Thenable<(USIndexItem | StockItem)[]> {
        if (element) {
            return Promise.resolve([]);
        }
        
        const items: (USIndexItem | StockItem)[] = [
            ...this.indices.map(i => new USIndexItem(i)),
            ...this.stocks.map(s => new StockItem(s))
        ];
        
        return Promise.resolve(items);
    }

    async updateData(): Promise<void> {
        const data = await this.apiService.getUSMarket();
        this.indices = data.indices;
        this.stocks = data.stocks;
        this.refresh();
    }
}

/**
 * 市场情绪树节点
 */
export class SentimentItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly value: string,
        public readonly description?: string,
        public readonly iconPath?: vscode.ThemeIcon
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description || value;
        this.contextValue = 'sentiment';
    }
}

/**
 * 市场情绪数据提供者
 */
export class SentimentProvider implements vscode.TreeDataProvider<SentimentItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SentimentItem | undefined | null | void> = new vscode.EventEmitter<SentimentItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SentimentItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sentiment: MarketSentiment | null = null;

    constructor(private apiService: StockApiService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SentimentItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SentimentItem): Thenable<SentimentItem[]> {
        if (element || !this.sentiment) {
            return Promise.resolve([]);
        }

        const items: SentimentItem[] = [
            // 市场强弱评分
            new SentimentItem(
                '市场强弱',
                `${this.sentiment.score}分`,
                `${this.getSentimentEmoji(this.sentiment.level)} ${this.sentiment.level} (${this.sentiment.score}分)`,
                this.getSentimentIcon(this.sentiment.score)
            ),
            // 涨跌停统计
            new SentimentItem(
                '涨停/跌停',
                `${this.sentiment.limitUp} / ${this.sentiment.limitDown}`,
                `🔥涨停 ${this.sentiment.limitUp}家  ❄️跌停 ${this.sentiment.limitDown}家`,
                new vscode.ThemeIcon('flame', new vscode.ThemeColor('charts.red'))
            ),
            // 涨跌统计
            new SentimentItem(
                '上涨/下跌',
                `${this.sentiment.upCount} / ${this.sentiment.downCount}`,
                `🔺${this.sentiment.upCount}家  🔻${this.sentiment.downCount}家  ➖${this.sentiment.flatCount}家`,
                new vscode.ThemeIcon(this.sentiment.upCount > this.sentiment.downCount ? 'arrow-up' : 'arrow-down',
                    new vscode.ThemeColor(this.sentiment.upCount > this.sentiment.downCount ? 'charts.green' : 'charts.red'))
            ),
            // 上涨占比
            new SentimentItem(
                '上涨占比',
                `${this.sentiment.upRatio.toFixed(1)}%`,
                `📊上涨家数占比 ${this.sentiment.upRatio.toFixed(1)}%`,
                new vscode.ThemeIcon('pie-chart', new vscode.ThemeColor(this.sentiment.upRatio > 50 ? 'charts.green' : 'charts.red'))
            ),
            // 炸板率
            new SentimentItem(
                '炸板率',
                `${this.sentiment.brokenRate.toFixed(1)}%`,
                `💥涨停打开 ${this.sentiment.brokenBoard}家 (炸板率 ${this.sentiment.brokenRate.toFixed(1)}%)`,
                new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
            ),
            // 总股票数
            new SentimentItem(
                '统计样本',
                `${this.sentiment.totalStocks}只`,
                `📈共统计 ${this.sentiment.totalStocks} 只A股`,
                new vscode.ThemeIcon('dashboard')
            )
        ];

        return Promise.resolve(items);
    }

    async updateData(): Promise<void> {
        this.sentiment = await this.apiService.getMarketSentiment();
        this.refresh();
    }

    /**
     * 根据评分获取图标
     */
    private getSentimentIcon(score: number): vscode.ThemeIcon {
        if (score >= 80) {
            return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.green'));
        } else if (score >= 60) {
            return new vscode.ThemeIcon('thumbsup', new vscode.ThemeColor('charts.green'));
        } else if (score >= 40) {
            return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.foreground'));
        } else if (score >= 20) {
            return new vscode.ThemeIcon('thumbsdown', new vscode.ThemeColor('charts.red'));
        } else {
            return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        }
    }

    /**
     * 根据情绪等级获取表情符号
     */
    private getSentimentEmoji(level: string): string {
        switch (level) {
            case '极强':
                return '🚀';
            case '强势':
                return '😊';
            case '中性':
                return '😐';
            case '弱势':
                return '😟';
            case '极弱':
                return '😱';
            default:
                return '❓';
        }
    }
}
