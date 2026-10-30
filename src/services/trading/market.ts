import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { type Contract, frequencies, wilsonLower } from './strategy';
export type Market = { symbol: string; name: string; precision: number };
export type ScanResult = {
    market: Market;
    contract: Contract;
    barrier: number;
    count: number;
    observed: number;
    lower: number;
    breakEven: number;
    score: number;
    counts: number[];
    timestamp: number;
};
type RawMarket = {
    symbol?: string;
    underlying_symbol?: string;
    display_name?: string;
    underlying_symbol_name?: string;
    pip_size?: number;
    pip?: number;
    is_trading_suspended?: number;
};
export type DerivResponse = {
    error?: { message: string };
    active_symbols?: RawMarket[];
    contracts_for?: {
        available: { contract_type: string; min_contract_duration: string; contract_category?: string }[];
    };
    history?: { prices: (number | string)[]; times: number[] };
    proposal?: { id: string; ask_price: number; payout: number };
    buy?: { contract_id: number };
    balance?: { loginid: string; currency: string; balance: number };
    portfolio?: { contracts: unknown[] };
    proposal_open_contract?: { is_sold: number; profit: number; contract_id: number };
    tick?: { symbol: string; quote: number; epoch: number };
    subscription?: { id: string };
};
export function connection() {
    const api = api_base.api;
    if (!api || Number(api.connection?.readyState) !== 1)
        throw new Error('Deriv is disconnected. Wait for reconnection and try again.');
    return api;
}
export async function request(payload: Record<string, unknown>, timeout = 15000): Promise<DerivResponse> {
    const api = connection();
    let timer: ReturnType<typeof setTimeout>;
    try {
        const response = (await Promise.race([
            Promise.resolve(api.send(payload)),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () =>
                        reject(
                            new Error(
                                payload.buy
                                    ? 'Purchase response unknown. Stop and inspect Deriv portfolio/history before trading again. No retry was sent.'
                                    : 'Deriv request timed out. Try again when connected.'
                            )
                        ),
                    timeout
                );
            }),
        ])) as unknown as DerivResponse;
        if (response?.error) throw new Error(response.error.message || 'Deriv rejected the request.');
        return response;
    } finally {
        clearTimeout(timer!);
    }
}
export async function getMarkets(): Promise<Market[]> {
    const response = await request({ active_symbols: 'brief' });
    return (response.active_symbols || [])
        .flatMap((s: RawMarket) => {
            const symbol = s.underlying_symbol || s.symbol || '';
            const pip = Number(s.pip_size ?? s.pip);
            const precision = pip > 0 ? Math.round(-Math.log10(pip)) : NaN;
            return /^(R_(10|25|50|75|100)|1HZ(10|25|50|75|100)V)$/.test(symbol) &&
                Number.isInteger(precision) &&
                precision >= 0 &&
                !s.is_trading_suspended
                ? [{ symbol, name: s.display_name || s.underlying_symbol_name || symbol, precision }]
                : [];
        })
        .sort((a: Market, b: Market) => a.symbol.localeCompare(b.symbol));
}
export async function supportedContracts(symbol: string): Promise<string[]> {
    const data = await request({ contracts_for: symbol });
    return (data.contracts_for?.available || [])
        .filter(c => c.min_contract_duration === '1t')
        .map(c => c.contract_type);
}
export function proposalPayload(symbol: string, contract: Contract, barrier: number, stake: number) {
    return {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type: contract,
        currency: 'USD',
        duration: 1,
        duration_unit: 't',
        underlying_symbol: symbol,
        ...(['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contract)
            ? { barrier: String(barrier) }
            : {}),
    };
}
export async function scanMarkets(
    markets: Market[],
    count: number,
    signal: AbortSignal,
    progress: (done: number, total: number, message: string) => void
): Promise<{ results: ScanResult[]; errors: string[] }> {
    if (!Number.isInteger(count) || count < 100 || count > 5000) throw new Error('Choose 100–5,000 ticks.');
    const results: ScanResult[] = [],
        errors: string[] = [];
    const check = () => {
        if (signal.aborted) throw new DOMException('Scan cancelled.', 'AbortError');
    };
    for (const [index, market] of markets.entries()) {
        check();
        progress(index, markets.length, `Reading ${market.name}`);
        try {
            const supported = await supportedContracts(market.symbol);
            check();
            const data = await request({ ticks_history: market.symbol, count, end: 'latest', style: 'ticks' });
            check();
            const prices = data.history?.prices?.map(Number) as number[] | undefined;
            const times = data.history?.times as number[] | undefined;
            if (!prices || prices.length < count || !times?.length || Date.now() / 1000 - times[times.length - 1] > 120)
                throw new Error('Insufficient or stale historical ticks.');
            const counts = frequencies(prices.slice(-count), market.precision);
            for (const [contract, barrier] of [
                ['DIGITOVER', 4],
                ['DIGITUNDER', 5],
            ] as const) {
                if (!supported.includes(contract)) continue;
                const quote = await request(proposalPayload(market.symbol, contract, barrier, 1));
                check();
                const ask = Number(quote.proposal?.ask_price),
                    payout = Number(quote.proposal?.payout);
                if (!(ask > 0 && payout > ask)) continue;
                const wins = counts.reduce(
                    (n, value, digit) =>
                        n + ((contract === 'DIGITOVER' ? digit > barrier : digit < barrier) ? value : 0),
                    0
                );
                const lower = wilsonLower(wins, count),
                    breakEven = ask / payout;
                results.push({
                    market,
                    contract,
                    barrier,
                    count,
                    counts,
                    observed: wins / count,
                    lower,
                    breakEven,
                    score: lower - breakEven,
                    timestamp: Date.now(),
                });
            }
        } catch (error) {
            check();
            errors.push(`${market.name}: ${error instanceof Error ? error.message : 'Market unavailable.'}`);
        }
        progress(index + 1, markets.length, `Analyzed ${index + 1} of ${markets.length} markets`);
    }
    return {
        results: results.sort(
            (a, b) =>
                b.score - a.score ||
                a.market.symbol.localeCompare(b.market.symbol) ||
                a.contract.localeCompare(b.contract)
        ),
        errors,
    };
}
