import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { reconcileSession, type SessionConfig, sessionSnapshot, startSession, stopSession } from '../session';
import { DEFAULT_RISK } from '../strategy';
jest.mock('@/external/bot-skeleton/services/api/api-base', () => ({
    api_base: { is_authorized: true, api: { connection: { readyState: 1 }, send: jest.fn() } },
}));
const send = api_base.api!.send as jest.Mock;
const config: SessionConfig = {
    market: { symbol: 'R_100', name: 'Volatility 100', precision: 2 },
    contract: 'DIGITOVER',
    barrier: 4,
    account: 'VRTC123',
    real: false,
    repeat: true,
    minPayoutRatio: 1.9,
    risk: { ...DEFAULT_RISK },
};
let lockAvailable = true;
let onProposal: (() => void) | undefined;
let buyUnknown = false;
let pendingProposal: Promise<unknown> | undefined;
let resolveProposal: ((value: unknown) => void) | undefined;
beforeEach(() => {
    jest.useFakeTimers();
    lockAvailable = true;
    onProposal = undefined;
    buyUnknown = false;
    pendingProposal = undefined;
    Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: { request: jest.fn((_name, _options, callback) => callback(lockAvailable ? {} : null)) },
    });
    send.mockReset().mockImplementation((payload: Record<string, unknown>) => {
        if (payload.balance) return Promise.resolve({ balance: { loginid: 'VRTC123', currency: 'USD', balance: 100 } });
        if (payload.contracts_for)
            return Promise.resolve({
                contracts_for: { available: [{ contract_type: 'DIGITOVER', min_contract_duration: '1t' }] },
            });
        if (payload.portfolio) return Promise.resolve({ portfolio: { contracts: [] } });
        if (payload.proposal) {
            onProposal?.();
            return pendingProposal || Promise.resolve({ proposal: { id: 'quote', ask_price: 0.35, payout: 0.7 } });
        }
        if (payload.buy)
            return buyUnknown
                ? Promise.reject(new Error('Connection lost'))
                : Promise.resolve({ buy: { contract_id: 42 } });
        if (payload.proposal_open_contract)
            return Promise.resolve({ proposal_open_contract: { is_sold: 1, profit: -0.35 } });
        return Promise.resolve({});
    });
});
afterEach(() => {
    jest.useRealTimers();
});
const buys = () => send.mock.calls.filter(([p]) => p.buy);
it('does not start while another tab owns the account lock', async () => {
    lockAvailable = false;
    await startSession(config, () => false);
    expect(buys()).toHaveLength(0);
    expect(sessionSnapshot().error).toContain('Another trading tab');
});
it('blocks an account mismatch before proposal or purchase', async () => {
    send.mockResolvedValueOnce({ balance: { loginid: 'REAL123', currency: 'USD', balance: 100 } });
    await startSession(config, () => false);
    expect(buys()).toHaveLength(0);
    expect(sessionSnapshot().error).toContain('Account changed');
});
it('stops when a live proposal arrives after Stop Trading', async () => {
    onProposal = stopSession;
    await startSession(config, () => false);
    expect(buys()).toHaveLength(0);
    expect(sessionSnapshot().busy).toBe(false);
});
it('rejects concurrent start calls while a proposal is pending', async () => {
    pendingProposal = new Promise(resolve => {
        resolveProposal = resolve;
    });
    const first = startSession(config, () => false);
    await jest.advanceTimersByTimeAsync(0);
    await expect(startSession(config, () => false)).rejects.toThrow('previous session');
    stopSession();
    resolveProposal!({ proposal: { id: 'q', ask_price: 0.35, payout: 0.7 } });
    await first;
    expect(buys()).toHaveLength(0);
});
it('never submits a next stake which exceeds the remaining loss budget', async () => {
    const run = startSession(
        { ...config, risk: { ...DEFAULT_RISK, stake: 0.35, stopLoss: 0.5, maxStake: 0.35 } },
        () => false
    );
    await jest.advanceTimersByTimeAsync(3000);
    await run;
    expect(buys()).toHaveLength(1);
    expect(sessionSnapshot().pnl).toBe(-0.35);
    expect(sessionSnapshot().trades).toBe(1);
});
it('rejects a worse payout ratio than the one reviewed', async () => {
    await startSession({ ...config, minPayoutRatio: 3 }, () => false);
    expect(buys()).toHaveLength(0);
});
it('holds uncertain purchases without retries and requires reconciliation', async () => {
    buyUnknown = true;
    await startSession(config, () => false);
    expect(buys()).toHaveLength(1);
    expect(sessionSnapshot().uncertain).toBe(true);
    await expect(startSession(config, () => false)).rejects.toThrow('reconcile');
    await reconcileSession();
    expect(sessionSnapshot().uncertain).toBe(false);
});
