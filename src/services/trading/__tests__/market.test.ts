import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { getMarkets, proposalPayload, scanMarkets } from '../market';
jest.mock('@/external/bot-skeleton/services/api/api-base', () => ({
    api_base: { api: { connection: { readyState: 1 }, send: jest.fn() } },
}));
const send = api_base.api!.send as jest.Mock;
const market = { symbol: 'R_100', name: 'Volatility 100', precision: 2 };
const history = (prices: number[]) => ({ history: { prices, times: prices.map(() => Math.floor(Date.now() / 1000)) } });
beforeEach(() => {
    send.mockReset();
});
it('discovers actual supported symbols and their pip precision', async () => {
    send.mockResolvedValue({
        active_symbols: [
            { underlying_symbol: 'R_100', display_name: 'Volatility 100', pip_size: 0.01 },
            { symbol: 'FAKE', pip: 0.01 },
            { symbol: 'R_25', is_trading_suspended: 1, pip: 0.01 },
        ],
    });
    expect(await getMarkets()).toEqual([market]);
    expect(send).toHaveBeenCalledWith({ active_symbols: 'brief' });
});
it('creates strict Over/Under proposal parameters', () => {
    expect(proposalPayload('R_100', 'DIGITUNDER', 5, 0.35)).toMatchObject({
        underlying_symbol: 'R_100',
        contract_type: 'DIGITUNDER',
        barrier: '5',
        duration: 1,
        amount: 0.35,
    });
    expect(proposalPayload('R_100', 'CALL', 5, 1)).not.toHaveProperty('barrier');
});
it('can return no qualifying market from balanced actual samples', async () => {
    send.mockImplementation((payload: Record<string, unknown>) => {
        if (payload.contracts_for)
            return Promise.resolve({
                contracts_for: {
                    available: [
                        { contract_type: 'DIGITOVER', min_contract_duration: '1t' },
                        { contract_type: 'DIGITUNDER', min_contract_duration: '1t' },
                    ],
                },
            });
        if (payload.ticks_history)
            return Promise.resolve(history(Array.from({ length: 100 }, (_, i) => 1 + (i % 10) / 100)));
        return Promise.resolve({ proposal: { ask_price: 1, payout: 1.95 } });
    });
    const result = await scanMarkets([market], 100, new AbortController().signal, jest.fn());
    expect(result.results).toHaveLength(2);
    expect(result.results.every(row => row.score < 0)).toBe(true);
    expect(result.results[0].count).toBe(100);
    expect(send.mock.calls.some(([p]) => p.buy)).toBe(false);
});
it('does not fabricate results when data is missing', async () => {
    send.mockResolvedValueOnce({ contracts_for: { available: [] } }).mockResolvedValueOnce(history([1.23]));
    const result = await scanMarkets([market], 100, new AbortController().signal, jest.fn());
    expect(result.results).toEqual([]);
    expect(result.errors[0]).toContain('Insufficient');
});
it('cancels before sending market requests', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(scanMarkets([market], 500, controller.signal, jest.fn())).rejects.toThrow('cancelled');
    expect(send).not.toHaveBeenCalled();
});
it('rejects out-of-range tick selections', async () => {
    await expect(scanMarkets([market], 99, new AbortController().signal, jest.fn())).rejects.toThrow('ticks');
});
it('selects candidates only when the empirical lower bound exceeds quoted break-even', async () => {
    send.mockImplementation((payload: Record<string, unknown>) => {
        if (payload.contracts_for)
            return Promise.resolve({
                contracts_for: { available: [{ contract_type: 'DIGITOVER', min_contract_duration: '1t' }] },
            });
        if (payload.ticks_history)
            return Promise.resolve(history(Array.from({ length: 100 }, (_, i) => (i < 90 ? 1.09 : 1.04))));
        return Promise.resolve({ proposal: { ask_price: 1, payout: 1.95 } });
    });
    const { results } = await scanMarkets([market], 100, new AbortController().signal, jest.fn());
    expect(results[0].contract).toBe('DIGITOVER');
    expect(results[0].observed).toBe(0.9);
    expect(results[0].score).toBeGreaterThan(0);
    expect(send.mock.calls.some(([payload]) => payload.buy)).toBe(false);
});
it('excludes stale samples instead of reporting them as live analysis', async () => {
    send.mockResolvedValueOnce({ contracts_for: { available: [] } }).mockResolvedValueOnce({
        history: { prices: Array(100).fill(1.23), times: Array(100).fill(1) },
    });
    const result = await scanMarkets([market], 100, new AbortController().signal, jest.fn());
    expect(result.results).toHaveLength(0);
    expect(result.errors[0]).toContain('stale');
});
