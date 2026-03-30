/**
 * 格式化金额
 */
export function formatAmount(amount: number): string {
    if (!amount) {
        return '-';
    }
    if (amount >= 100000000) {
        return (amount / 100000000).toFixed(2) + '亿';
    } else if (amount >= 10000) {
        return (amount / 10000).toFixed(2) + '万';
    }
    return amount.toFixed(2);
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number): string {
    if (!value) {
        return '0.00%';
    }
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

/**
 * 格式化价格
 */
export function formatPrice(price: number): string {
    if (!price) {
        return '-';
    }
    return price.toFixed(2);
}
