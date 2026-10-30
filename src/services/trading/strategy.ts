/** Pure, deterministic statistics. Historical frequencies are not predictions. */
export type Contract =
    'CALL' | 'PUT' | 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITMATCH' | 'DIGITDIFF';
export type RiskSettings = {
    stake: number;
    multiplier: number;
    takeProfit: number;
    stopLoss: number;
    maxStake: number;
    maxSteps: number;
    maxTrades: number;
};
export const DEFAULT_RISK: RiskSettings = {
    stake: 0.35,
    multiplier: 1,
    takeProfit: 3,
    stopLoss: 5,
    maxStake: 1,
    maxSteps: 0,
    maxTrades: 20,
};
export function lastDigit(price: number, precision: number): number {
    if (!Number.isFinite(price) || !Number.isInteger(precision) || precision < 0 || precision > 10)
        throw new Error('Invalid quote precision.');
    return Number(Math.abs(price).toFixed(precision).slice(-1));
}
export function frequencies(prices: number[], precision: number): number[] {
    const counts = Array<number>(10).fill(0);
    prices.forEach(price => counts[lastDigit(price, precision)]++);
    return counts;
}
export function wilsonLower(wins: number, n: number): number {
    if (!n) return 0;
    const z = 1.96,
        p = wins / n;
    return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}
export function validateRisk(r: RiskSettings, balance: number): string | null {
    if (!Object.values(r).every(Number.isFinite) || !Number.isFinite(balance))
        return 'Enter finite numbers for every risk setting.';
    if (r.stake < 0.35 || r.stake > balance || Math.abs(r.stake * 100 - Math.round(r.stake * 100)) > 1e-6)
        return 'Stake must be at least 0.35 USD, within your balance, and use at most two decimals. Deriv may impose a higher minimum.';
    if (r.multiplier < 1 || r.multiplier > 5) return 'Recovery multiplier must be between 1 and 5.';
    if (r.takeProfit <= 0 || r.stopLoss <= 0 || r.stopLoss > balance)
        return 'Profit and loss limits must be positive; loss limit cannot exceed your balance.';
    if (r.maxStake < r.stake || r.maxStake > r.stopLoss || r.maxStake > balance)
        return 'Maximum stake must cover the base stake and fit within the loss limit and balance.';
    if (
        !Number.isInteger(r.maxSteps) ||
        r.maxSteps < 0 ||
        r.maxSteps > 10 ||
        !Number.isInteger(r.maxTrades) ||
        r.maxTrades < 1 ||
        r.maxTrades > 100
    )
        return 'Use 0–10 recovery steps and 1–100 trades.';
    return null;
}
export function nextStake(r: RiskSettings, consecutiveLosses: number): number {
    if (consecutiveLosses > r.maxSteps && r.multiplier > 1) throw new Error('Maximum recovery steps reached.');
    const value = Math.ceil((r.stake * r.multiplier ** consecutiveLosses - 1e-9) * 100) / 100;
    if (!Number.isFinite(value) || value > r.maxStake) throw new Error('Maximum stake reached.');
    return value;
}
export function canExpose(stake: number, pnl: number, lossLimit: number, grossLoss: number): boolean {
    return (
        [stake, pnl, lossLimit, grossLoss].every(Number.isFinite) &&
        stake > 0 &&
        pnl - stake >= -lossLimit - 1e-9 &&
        grossLoss + stake <= lossLimit + 1e-9
    );
}
export const BOT_FAMILIES = [
    {
        name: 'Rise & Fall',
        description: 'A one-tick directional contract. Choose Rise or Fall.',
        contracts: ['CALL', 'PUT'] as Contract[],
    },
    {
        name: 'Even & Odd',
        description: 'Trade the parity of the settlement tick’s last digit.',
        contracts: ['DIGITEVEN', 'DIGITODD'] as Contract[],
    },
    {
        name: 'Over & Under',
        description: 'Trade a last digit strictly above or below your barrier.',
        contracts: ['DIGITOVER', 'DIGITUNDER'] as Contract[],
    },
    {
        name: 'Matches & Differs',
        description: 'Trade whether the final digit matches your selected digit.',
        contracts: ['DIGITMATCH', 'DIGITDIFF'] as Contract[],
    },
];
export const CONTRACT_LABELS: Record<Contract, string> = {
    CALL: 'Rise',
    PUT: 'Fall',
    DIGITEVEN: 'Even',
    DIGITODD: 'Odd',
    DIGITOVER: 'Over',
    DIGITUNDER: 'Under',
    DIGITMATCH: 'Matches',
    DIGITDIFF: 'Differs',
};
