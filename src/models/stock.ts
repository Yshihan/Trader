export interface Stock {
    code: string;          // 股票代码
    name: string;          // 股票名称
    price: number;         // 当前价格
    change: number;        // 涨跌额
    changePercent: number; // 涨跌幅
    volume: number;        // 成交量
    amount: number;        // 成交额
    high: number;          // 最高价
    low: number;           // 最低价
    open: number;          // 开盘价
    preClose: number;      // 昨收价
    pinned?: boolean;      // 是否置顶
    order?: number;        // 排序顺序
}

export interface Sector {
    code: string;          // 板块代码
    name: string;          // 板块名称
    change: number;        // 涨跌额
    changePercent: number; // 涨跌幅
    amount: number;        // 资金流入
    leadingStock?: string; // 领涨股
}

export interface Index {
    code: string;          // 指数代码
    name: string;          // 指数名称
    price: number;         // 当前点位
    change: number;        // 涨跌点数
    changePercent: number; // 涨跌幅
    volume: number;        // 成交量
    amount: number;        // 成交额
}

export interface GlobalIndex {
    name: string;          // 指数名称
    price: number;         // 当前点位
    change: number;        // 涨跌点数
    changePercent: number; // 涨跌幅
    country: string;       // 国家/地区
}

export interface MarketSentiment {
    limitUp: number;       // 涨停家数
    limitDown: number;     // 跌停家数
    upCount: number;       // 上涨家数
    downCount: number;     // 下跌家数
    flatCount: number;     // 平盘家数
    brokenBoard: number;   // 炸板家数
    totalStocks: number;   // 总股票数
    upRatio: number;       // 上涨占比
    brokenRate: number;    // 炸板率
    score: number;         // 市场强弱评分 (0-100)
    level: string;         // 市场情绪等级
}
