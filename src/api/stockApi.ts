import axios from 'axios';
import * as iconv from 'iconv-lite';
import { Stock, Sector, Index, GlobalIndex, MarketSentiment } from '../models/stock';

/**
 * 股票数据API服务
 * 使用新浪财经接口获取实时数据
 */
export class StockApiService {
    private readonly BASE_URL = 'https://hq.sinajs.cn';
    private readonly SECTOR_URL = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData';
    
    /**
     * 搜索股票
     */
    async searchStock(keyword: string): Promise<Stock[]> {
        try {
            // 使用新浪股票搜索接口
            const url = `https://suggest3.sinajs.cn/suggest/name`;
            
            // 直接构造完整URL
            const fullUrl = `${url}?key=${encodeURIComponent(keyword)}&name=suggestdata`;
            
            const response = await axios.get(fullUrl, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                responseType: 'arraybuffer',
                timeout: 5000
            });
            
            // 使用iconv-lite正确处理GBK编码
            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            
            if (!data || data.includes('suggestdata=""')) {
                return [];
            }

            // 解析返回数据: var suggestdata="xxx";
            const match = data.match(/suggestdata="(.+?)"/);
            if (!match || !match[1]) {
                return [];
            }

            const items = match[1].split(';').filter(s => s.trim());
            const stocks: Stock[] = [];

            for (const item of items.slice(0, 20)) {
                const parts = item.split(',');
                if (parts.length >= 4) {
                    // 格式: 名称,类型,纯代码,完整代码,...
                    // 例如: 贵州茅台,11,600519,sh600519,...
                    // 或: sh600519,11,600519,sh600519,贵州茅台,...
                    
                    let code = '';
                    let name = '';
                    
                    // 判断第一个字段是代码还是名称
                    if (parts[0].startsWith('sh') || parts[0].startsWith('sz')) {
                        // 格式1: sh600519,11,600519,sh600519,贵州茅台,...
                        code = parts[0];
                        name = parts[4] || parts[0];
                    } else if (parts[3] && (parts[3].startsWith('sh') || parts[3].startsWith('sz'))) {
                        // 格式2: 贵州茅台,11,600519,sh600519,...
                        code = parts[3];
                        name = parts[0];
                    }
                    
                    // 只保留A股
                    if (code && (code.startsWith('sh') || code.startsWith('sz'))) {
                        stocks.push({
                            code: code,
                            name: name,
                            price: 0,
                            change: 0,
                            changePercent: 0,
                            volume: 0,
                            amount: 0,
                            high: 0,
                            low: 0,
                            open: 0,
                            preClose: 0
                        });
                    }
                }
            }

            return stocks;
        } catch (error: any) {
            console.error('搜索股票失败:', error.message);
            return [];
        }
    }

    /**
     * 获取股票实时行情
     */
    async getStockPrice(codes: string[]): Promise<Map<string, Stock>> {
        const result = new Map<string, Stock>();
        
        if (codes.length === 0) {
            return result;
        }

        try {
            // 分批请求，每次最多50个
            const batchSize = 50;
            for (let i = 0; i < codes.length; i += batchSize) {
                const batch = codes.slice(i, i + batchSize);
                const list = batch.join(',');
                
                const response = await axios.get(this.BASE_URL, {
                    params: { list },
                    headers: {
                        'Referer': 'https://finance.sina.com.cn'
                    },
                    responseType: 'arraybuffer',
                    timeout: 8000
                });

                // 使用iconv-lite正确处理GBK编码
                const data = iconv.decode(Buffer.from(response.data), 'gbk');
                
                const lines = data.split('\n');
                
                for (const line of lines) {
                    const codeMatch = line.match(/hq_str_(.+?)=/);
                    const dataMatch = line.match(/="(.+)"/);
                    
                    if (codeMatch && dataMatch) {
                        const code = codeMatch[1];
                        const values = dataMatch[1].split(',');
                        
                        if (values.length >= 32) {
                            const stock: Stock = {
                                code: code,
                                name: values[0],
                                open: parseFloat(values[1]),
                                preClose: parseFloat(values[2]),
                                price: parseFloat(values[3]),
                                high: parseFloat(values[4]),
                                low: parseFloat(values[5]),
                                volume: parseFloat(values[8]),
                                amount: parseFloat(values[9]),
                                change: parseFloat(values[3]) - parseFloat(values[2]),
                                changePercent: (parseFloat(values[3]) - parseFloat(values[2])) / parseFloat(values[2]) * 100
                            };
                            result.set(code, stock);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取股票价格失败:', error);
        }

        return result;
    }

    /**
     * 获取行业板块资金流入排行
     * 使用新浪行业ETF数据
     */
    async getSectorRanking(): Promise<Sector[]> {
        try {
            // 使用热门行业ETF代码（每个子行业保留规模最大的代表性ETF）
            const industryCodes = [
                // 科技类
                'sh512760', // 半导体ETF（规模最大）
                'sh159995', // 芯片ETF
                'sh515050', // 5GETF
                'sh515070', // 人工智能ETF
                'sh516510', // 云计算ETF
                'sh515400', // 大数据ETF

                // 新能源类
                'sh515790', // 光伏ETF（规模最大）
                'sh516160', // 新能源ETF
                'sh515030', // 新能源车ETF
                'sh159875', // 电池ETF
                'sh516850', // 储能ETF
                'sh159861', // 风电ETF

                // 周期类
                'sh512400', // 有色金属ETF
                'sh516780', // 稀土ETF
                'sh515180', // 钢铁ETF
                'sh515220', // 煤炭ETF（规模最大）
                'sh159801', // 化工ETF
                'sh512950', // 建材ETF

                // 消费类
                'sh512690', // 酒ETF（规模最大）
                'sh512170', // 医疗ETF（规模最大）
                'sh159992', // 创新药ETF
                'sh159882', // 生物医药ETF
                'sh512200', // 房地产ETF
                'sh159940', // 家电ETF
                'sh515170', // 食品饮料ETF
                'sh159728', // 消费电子ETF
                'sh159966', // 消费龙头ETF
                'sh159766', // 旅游ETF

                // 金融类
                'sh512880', // 证券ETF（规模最大）
                'sh512800', // 银行ETF
                'sh512820', // 保险ETF
                'sh512970', // 非银金融ETF

                // 军工类
                'sh512660', // 军工ETF（规模最大）
                'sh512680', // 国防军工ETF

                // 其他
                'sh512980', // 传媒ETF（规模最大）
                'sh515950', // 基建ETF
                'sh159825', // 农业种植ETF
                'sh159765', // 养殖ETF
                'sh516110', // 汽车ETF
                'sh159611', // 电力ETF
            ];

            // 使用新浪行情接口
            const url = `https://hq.sinajs.cn/list=${industryCodes.join(',')}`;
            const response = await axios.get(url, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                responseType: 'arraybuffer',
                timeout: 8000
            });

            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            const lines = data.split('\n');
            
            const sectors: Sector[] = [];
            for (const line of lines) {
                const codeMatch = line.match(/hq_str_(.+?)=/);
                const dataMatch = line.match(/="(.+)"/);
                
                if (codeMatch && dataMatch && dataMatch[1]) {
                    const values = dataMatch[1].split(',');
                    if (values.length >= 32) {
                        const name = values[0];
                        const price = parseFloat(values[3]) || 0; // 当前价格（values[3]）
                        const preClose = parseFloat(values[2]) || 0; // 昨收价
                        const amount = parseFloat(values[9]) || 0; // 成交额（万元）
                        const changePercent = preClose > 0 ? ((price - preClose) / preClose * 100) : 0;
                        
                        // 过滤掉无效数据
                        if (name && price > 0) {
                            sectors.push({
                                code: codeMatch[1],
                                name: name,
                                change: price - preClose,
                                changePercent: changePercent,
                                amount: amount * 10000 // 转换为元
                            });
                        }
                    }
                }
            }

            console.log(`从新浪获取到 ${sectors.length} 个行业板块`);

            if (sectors.length > 0) {
                // 返回所有有效数据，在Provider层按涨跌幅排序
                return sectors;
            }

            return this.getDefaultSectors();
        } catch (error) {
            console.error('获取板块排行失败:', error);
            return this.getDefaultSectors();
        }
    }

    /**
     * 获取国内指数
     */
    async getMainIndex(): Promise<Index[]> {
        const codes = ['sh000001', 'sh000300', 'sz399001', 'sz399006'];
        const stockMap = await this.getStockPrice(codes);
        
        const indices: Index[] = [];
        stockMap.forEach((stock, code) => {
            indices.push({
                code: stock.code,
                name: stock.name,
                price: stock.price,
                change: stock.change,
                changePercent: stock.changePercent,
                volume: stock.volume,
                amount: stock.amount
            });
        });

        return indices.length > 0 ? indices : this.getDefaultIndices();
    }

    /**
     * 获取全球股指
     * 统一使用新浪全球指数接口
     */
    async getGlobalIndex(): Promise<GlobalIndex[]> {
        try {
            // 新浪全球指数代码（测试可用的代码）
            const codes = [
                'gb_$dji',     // 道琼斯
                'gb_$ndx',     // 纳斯达克100
                'gb_$spx',     // 标普500
                'gb_$hsi',     // 恒生指数
                'gb_$n225',    // 日经225
                'gb_$ukx',     // 富时100
                'gb_$dax',     // 德国DAX
                'gb_$cac',     // 法国CAC40
                'gb_$sti',     // 新加坡海峡时报
                'gb_$axjo',    // 澳大利亚标普200
                'gb_$twii',    // 台湾加权
                'gb_$ks11',    // 韩国综合
                'gb_$bvsp',    // 巴西
                'gb_$mxx',     // 墨西哥
                'gb_$rts',     // 俄罗斯
                'gb_$jn0',     // 日本东证
                'gb_$fchi',    // 法国
                'gb_$ssmi',    // 瑞士
                'gb_$omx',     // 瑞典
                'gb_$aex'      // 荷兰
            ].join(',');
            
            const response = await axios.get(`https://hq.sinajs.cn/list=${codes}`, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0'
                },
                responseType: 'arraybuffer',
                timeout: 5000
            });

            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            const lines = data.split('\n');
            
            const indices: GlobalIndex[] = [];
            // 国家/地区映射（根据代码前缀或名称判断）
            const countryMap: { [key: string]: string } = {
                '道琼斯': '美国',
                '纳斯达克': '美国',
                '标普': '美国',
                '恒生': '香港',
                '日经': '日本',
                '富时': '英国',
                '德国DAX': '德国',
                '法国': '法国',
                '海峡': '新加坡',
                '澳洲': '澳大利亚',
                '台湾': '台湾',
                '韩国': '韩国',
                '巴西': '巴西',
                '墨西哥': '墨西哥',
                '俄罗斯': '俄罗斯',
                '东证': '日本',
                '瑞士': '瑞士',
                '瑞典': '瑞典',
                '荷兰': '荷兰'
            };

            for (const line of lines) {
                const codeMatch = line.match(/hq_str_(.+?)=/);
                const dataMatch = line.match(/="(.+)"/);
                
                if (codeMatch && dataMatch && dataMatch[1]) {
                    const code = codeMatch[1];
                    const values = dataMatch[1].split(',');
                    
                    // 必须有足够的数据且名称不为空
                    if (values.length >= 2 && values[0] && values[0].trim() !== '') {
                        const name = values[0];
                        const price = parseFloat(values[1]) || 0;
                        const change = parseFloat(values[2]) || 0;
                        const changePercent = price > 0 ? (change / price * 100) : 0;
                        
                        // 根据名称判断国家
                        let country = '其他';
                        for (const [key, value] of Object.entries(countryMap)) {
                            if (name.includes(key)) {
                                country = value;
                                break;
                            }
                        }
                        
                        indices.push({
                            name: name,
                            price: price,
                            change: change,
                            changePercent: changePercent,
                            country: country
                        });
                    }
                }
            }

            console.log(`从新浪获取到 ${indices.length} 个全球指数`);
            
            if (indices.length > 0) {
                return indices;
            }

            return this.getDefaultGlobalIndices();
        } catch (error) {
            console.error('获取全球指数失败:', error);
            return this.getDefaultGlobalIndices();
        }
    }

    /**
     * 获取美股市场数据（包括指数和科技七姐妹）
     */
    async getUSMarket(): Promise<{ indices: GlobalIndex[]; stocks: Stock[] }> {
        try {
            // 指数代码
            const indexCodes = ['gb_$dji', 'gb_$ndx', 'gb_$spx'];
            // 科技七姐妹代码
            const techCodes = ['gb_aapl', 'gb_msft', 'gb_googl', 'gb_amzn', 'gb_nvda', 'gb_tsla', 'gb_meta'];
            
            const allCodes = [...indexCodes, ...techCodes].join(',');
            
            const response = await axios.get(`https://hq.sinajs.cn/list=${allCodes}`, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0'
                },
                responseType: 'arraybuffer',
                timeout: 5000
            });

            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            const lines = data.split('\n');
            
            const indices: GlobalIndex[] = [];
            const stocks: Stock[] = [];
            const indexSet = new Set(indexCodes);

            for (const line of lines) {
                const codeMatch = line.match(/hq_str_(.+?)=/);
                const dataMatch = line.match(/="(.+)"/);
                
                if (codeMatch && dataMatch && dataMatch[1]) {
                    const code = codeMatch[1];
                    const values = dataMatch[1].split(',');
                    
                    if (values.length >= 2 && values[0] && values[0].trim() !== '') {
                        const name = values[0];
                        const price = parseFloat(values[1]) || 0;
                        const change = parseFloat(values[2]) || 0;
                        
                        if (indexSet.has(code)) {
                            // 指数
                            const changePercent = price > 0 ? (change / price * 100) : 0;
                            indices.push({
                                name: name,
                                price: price,
                                change: change,
                                changePercent: changePercent,
                                country: '美国'
                            });
                        } else {
                            // 个股
                            const preClose = price > 0 && change !== 0 ? price - change : (parseFloat(values[26]) || price);
                            const changePercent = preClose > 0 ? (change / preClose * 100) : 0;
                            
                            stocks.push({
                                code: code,
                                name: name,
                                price: price,
                                change: change,
                                changePercent: changePercent,
                                volume: parseFloat(values[10]) || 0,
                                amount: 0,
                                high: parseFloat(values[4]) || 0,
                                low: parseFloat(values[5]) || 0,
                                open: parseFloat(values[3]) || 0,
                                preClose: preClose
                            });
                        }
                    }
                }
            }

            console.log(`从新浪获取到 ${indices.length} 个美股指数, ${stocks.length} 个美股个股`);
            
            return { indices, stocks };
        } catch (error) {
            console.error('获取美股市场数据失败:', error);
            return {
                indices: [
                    { name: '道琼斯', price: 38000, change: 0, changePercent: 0, country: '美国' },
                    { name: '纳斯达克', price: 16000, change: 0, changePercent: 0, country: '美国' },
                    { name: '标普500', price: 5000, change: 0, changePercent: 0, country: '美国' }
                ],
                stocks: this.getDefaultUSTechStocks()
            };
        }
    }

    /**
     * 搜索美股
     */
    async searchUSStock(keyword: string): Promise<Stock[]> {
        try {
            // 新浪美股搜索接口
            const url = `https://suggest3.sinajs.cn/suggest/name`;
            const fullUrl = `${url}?key=${encodeURIComponent(keyword)}&name=suggestdata`;
            
            const response = await axios.get(fullUrl, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0'
                },
                responseType: 'arraybuffer',
                timeout: 5000
            });
            
            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            
            if (!data || data.includes('suggestdata=""')) {
                return [];
            }

            const match = data.match(/suggestdata="(.+?)"/);
            if (!match || !match[1]) {
                return [];
            }

            const items = match[1].split(';').filter(s => s.trim());
            const stocks: Stock[] = [];

            for (const item of items.slice(0, 20)) {
                const parts = item.split(',');
                if (parts.length >= 3) {
                    // 格式: 名称,市场类型,代码,...
                    // 例如: AAPL,103,aapl,aapl,AAPL,...
                    // 或者: 苹果公司,103,aapl,aapl,苹果公司,...
                    const name = parts[0];
                    const marketType = parts[1];
                    const code = parts[2];
                    
                    // 市场类型 103 是美股
                    if (marketType === '103' && code) {
                        stocks.push({
                            code: `gb_${code.toLowerCase()}`,  // 转换为 gb_aapl 格式
                            name: name,
                            price: 0,
                            change: 0,
                            changePercent: 0,
                            volume: 0,
                            amount: 0,
                            high: 0,
                            low: 0,
                            open: 0,
                            preClose: 0
                        });
                    }
                }
            }

            return stocks;
        } catch (error: any) {
            console.error('搜索美股失败:', error.message);
            return [];
        }
    }

    /**
     * 获取美股价格
     */
    async getUSStockPrice(codes: string[]): Promise<Map<string, Stock>> {
        const result = new Map<string, Stock>();
        
        if (codes.length === 0) {
            return result;
        }

        try {
            const codeStr = codes.join(',');
            const response = await axios.get(`https://hq.sinajs.cn/list=${codeStr}`, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn',
                    'User-Agent': 'Mozilla/5.0'
                },
                responseType: 'arraybuffer',
                timeout: 5000
            });

            const data = iconv.decode(Buffer.from(response.data), 'gbk');
            const lines = data.split('\n');

            for (const line of lines) {
                const codeMatch = line.match(/hq_str_(.+?)=/);
                const dataMatch = line.match(/="(.+)"/);
                
                if (codeMatch && dataMatch && dataMatch[1]) {
                    const code = codeMatch[1];
                    const values = dataMatch[1].split(',');
                    
                    if (values.length >= 2 && values[0] && values[0].trim() !== '') {
                        const price = parseFloat(values[1]) || 0;
                        const change = parseFloat(values[2]) || 0;
                        const preClose = price > 0 && change !== 0 ? price - change : (parseFloat(values[26]) || price);
                        const changePercent = preClose > 0 ? (change / preClose * 100) : 0;
                        
                        result.set(code, {
                            code: code,
                            name: values[0],
                            price: price,
                            change: change,
                            changePercent: changePercent,
                            volume: parseFloat(values[10]) || 0,
                            amount: 0,
                            high: parseFloat(values[4]) || 0,
                            low: parseFloat(values[5]) || 0,
                            open: parseFloat(values[3]) || 0,
                            preClose: preClose
                        });
                    }
                }
            }
        } catch (error) {
            console.error('获取美股价格失败:', error);
        }

        return result;
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取单页股票数据（支持重试）
     */
    private async fetchStockPage(page: number, pageSize: number, retries: number = 3): Promise<any[]> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get('http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData', {
                    params: {
                        page: page,
                        num: pageSize,
                        sort: 'symbol',
                        asc: 1,
                        node: 'hs_a',
                        symbol: '',
                        _s_r_a: 'page'
                    },
                    headers: {
                        'Referer': 'http://vip.stock.finance.sina.com.cn',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 10000
                });

                return response.data || [];
            } catch (error: any) {
                if (error.response?.status === 456 || attempt < retries) {
                    console.log(`第 ${page} 页请求失败(尝试 ${attempt}/${retries})，等待重试...`);
                    await this.delay(500 * attempt); // 递增延迟
                } else {
                    console.error(`获取第 ${page} 页数据失败:`, error.message);
                    return [];
                }
            }
        }
        return [];
    }

    /**
     * 获取市场情绪指标
     */
    async getMarketSentiment(): Promise<MarketSentiment> {
        try {
            const startTime = Date.now();
            
            // 降低并发数并添加延迟，避免触发456限流
            const pageSize = 80;
            const maxPages = 60;
            const concurrentRequests = 3; // 降低并发数：10 → 3
            const batchDelay = 200; // 批次间延迟200ms
            
            const allStocks: any[] = [];
            const pagePromises: Promise<any[]>[] = [];
            
            // 创建所有分页请求的Promise
            for (let page = 1; page <= maxPages; page++) {
                pagePromises.push(this.fetchStockPage(page, pageSize));
            }
            
            // 分批并发执行请求
            for (let i = 0; i < pagePromises.length; i += concurrentRequests) {
                const batch = pagePromises.slice(i, i + concurrentRequests);
                const results = await Promise.all(batch);
                
                for (const stocks of results) {
                    if (stocks && stocks.length > 0) {
                        allStocks.push(...stocks);
                    }
                }
                
                // 批次间添加延迟，避免触发限流
                if (i + concurrentRequests < pagePromises.length) {
                    await this.delay(batchDelay);
                }
                
                // 如果某批次返回的数据量不足，说明已经到末尾
                const lastBatch = results[results.length - 1];
                if (lastBatch && lastBatch.length < pageSize) {
                    break;
                }
            }

            if (allStocks.length === 0) {
                return this.getDefaultSentiment();
            }

            const endTime = Date.now();
            console.log(`市场情绪：总共获取到 ${allStocks.length} 只A股数据，耗时 ${(endTime - startTime) / 1000} 秒`);

            // 统计各项指标
            let limitUp = 0;
            let limitDown = 0;
            let upCount = 0;
            let downCount = 0;
            let flatCount = 0;
            let brokenBoard = 0;

            for (const stock of allStocks) {
                const changePercent = parseFloat(stock.changepercent) || 0;

                // 涨停（涨幅>=9.9%）
                if (changePercent >= 9.9) {
                    limitUp++;
                }
                // 跌停（跌幅<=-9.9%）
                else if (changePercent <= -9.9) {
                    limitDown++;
                }

                // 上涨下跌统计
                if (changePercent > 0.1) {
                    upCount++;
                } else if (changePercent < -0.1) {
                    downCount++;
                } else {
                    flatCount++;
                }

                // 炸板：涨幅在7%-9.9%之间（曾经涨停但打开了）
                if (changePercent >= 7 && changePercent < 9.9) {
                    brokenBoard++;
                }
            }

            const totalStocks = allStocks.length;
            const upRatio = totalStocks > 0 ? (upCount / totalStocks * 100) : 0;
            const brokenRate = (limitUp + brokenBoard) > 0 ? (brokenBoard / (limitUp + brokenBoard) * 100) : 0;

            // 计算市场强弱评分 (0-100)
            // 综合考虑：上涨家数占比、涨停家数、炸板率
            const score = this.calculateSentimentScore(upRatio, limitUp, limitDown, brokenRate);

            // 确定市场情绪等级
            const level = this.getSentimentLevel(score);

            return {
                limitUp,
                limitDown,
                upCount,
                downCount,
                flatCount,
                brokenBoard,
                totalStocks,
                upRatio,
                brokenRate,
                score,
                level
            };
        } catch (error) {
            console.error('获取市场情绪失败:', error);
            return this.getDefaultSentiment();
        }
    }

    /**
     * 计算市场强弱评分
     */
    private calculateSentimentScore(upRatio: number, limitUp: number, limitDown: number, brokenRate: number): number {
        // 上涨家数占比权重 50%
        const upScore = upRatio * 0.5;

        // 涨停家数权重 30%（涨停越多，市场越强）
        const limitScore = Math.min(limitUp * 2, 30) * 0.3;

        // 炸板率权重 20%（炸板率越低，市场越强）
        const brokenScore = Math.max(20 - brokenRate * 0.2, 0) * 0.2;

        return Math.round(upScore + limitScore + brokenScore);
    }

    /**
     * 获取市场情绪等级
     */
    private getSentimentLevel(score: number): string {
        if (score >= 80) {
            return '极强';
        } else if (score >= 60) {
            return '强势';
        } else if (score >= 40) {
            return '中性';
        } else if (score >= 20) {
            return '弱势';
        } else {
            return '极弱';
        }
    }

    /**
     * 默认市场情绪
     */
    private getDefaultSentiment(): MarketSentiment {
        return {
            limitUp: 0,
            limitDown: 0,
            upCount: 0,
            downCount: 0,
            flatCount: 0,
            brokenBoard: 0,
            totalStocks: 0,
            upRatio: 0,
            brokenRate: 0,
            score: 0,
            level: '未知'
        };
    }

    /**
     * 默认板块数据
     */
    private getDefaultSectors(): Sector[] {
        return [
            { code: 'BK0001', name: '半导体', change: 0, changePercent: 0, amount: 0 },
            { code: 'BK0002', name: '人工智能', change: 0, changePercent: 0, amount: 0 },
            { code: 'BK0003', name: '新能源', change: 0, changePercent: 0, amount: 0 }
        ];
    }

    /**
     * 默认指数数据
     */
    private getDefaultIndices(): Index[] {
        return [
            { code: 'sh000001', name: '上证指数', price: 3000, change: 0, changePercent: 0, volume: 0, amount: 0 },
            { code: 'sz399001', name: '深证成指', price: 10000, change: 0, changePercent: 0, volume: 0, amount: 0 },
            { code: 'sh000300', name: '沪深300', price: 4000, change: 0, changePercent: 0, volume: 0, amount: 0 },
            { code: 'sz399006', name: '创业板指', price: 2000, change: 0, changePercent: 0, volume: 0, amount: 0 }
        ];
    }

    /**
     * 默认全球指数数据
     */
    private getDefaultGlobalIndices(): GlobalIndex[] {
        return [
            { name: '道琼斯', price: 38000, change: 0, changePercent: 0, country: '美国' },
            { name: '纳斯达克', price: 15000, change: 0, changePercent: 0, country: '美国' },
            { name: '标普500', price: 5000, change: 0, changePercent: 0, country: '美国' },
            { name: '恒生指数', price: 17000, change: 0, changePercent: 0, country: '香港' },
            { name: '日经225', price: 38000, change: 0, changePercent: 0, country: '日本' },
            { name: '富时100', price: 7700, change: 0, changePercent: 0, country: '英国' }
        ];
    }

    /**
     * 默认美股科技股数据
     */
    private getDefaultUSTechStocks(): Stock[] {
        return [
            { code: 'gb_aapl', name: '苹果', price: 180, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 180 },
            { code: 'gb_msft', name: '微软', price: 380, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 380 },
            { code: 'gb_googl', name: '谷歌', price: 140, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 140 },
            { code: 'gb_amzn', name: '亚马逊', price: 180, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 180 },
            { code: 'gb_nvda', name: '英伟达', price: 800, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 800 },
            { code: 'gb_tsla', name: '特斯拉', price: 250, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 250 },
            { code: 'gb_meta', name: 'Meta', price: 500, change: 0, changePercent: 0, volume: 0, amount: 0, high: 0, low: 0, open: 0, preClose: 500 }
        ];
    }
}
