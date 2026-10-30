import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { connection, type DerivResponse, type Market, proposalPayload, request, supportedContracts } from './market';
import { canExpose, type Contract, nextStake, type RiskSettings, validateRisk } from './strategy';
export type SessionConfig = {
    market: Market;
    contract: Contract;
    barrier: number;
    risk: RiskSettings;
    account: string;
    real: boolean;
    repeat: boolean;
    minPayoutRatio: number;
};
export type SessionSnapshot = {
    busy: boolean;
    status: string;
    pnl: number;
    trades: number;
    contractId?: number;
    error?: string;
    uncertain?: boolean;
    records: { id: number; profit: number }[];
};
let snapshot: SessionSnapshot = { busy: false, status: 'Ready — no active session', pnl: 0, trades: 0, records: [] };
const listeners = new Set<() => void>();
let stopped = false;
export const sessionSnapshot = () => snapshot;
export const subscribeSession = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
const update = (change: Partial<SessionSnapshot>) => {
    snapshot = { ...snapshot, ...change };
    listeners.forEach(fn => fn());
};
export const holdSession = () =>
    update({
        uncertain: true,
        error: 'A bot purchase response is unknown. Reconcile Deriv portfolio and history before another session.',
    });
export const stopSession = () => {
    stopped = true;
    if (snapshot.busy)
        update({
            status: snapshot.contractId
                ? 'Stopping — existing contract remains open until settlement'
                : 'Stopping — no further orders',
        });
};
const pause = () => new Promise(resolve => setTimeout(resolve, 1000));
export async function reconcileSession() {
    if (snapshot.busy) return;
    const { portfolio } = await request({ portfolio: 1 });
    if (portfolio?.contracts?.length)
        throw new Error(
            'An open contract exists. Wait for settlement and inspect Deriv history before clearing the hold.'
        );
    // Refresh the authoritative account history as well; this does not retry any purchase.
    await request({ statement: 1, limit: 20, description: 1 });
    update({
        uncertain: false,
        error: undefined,
        status: 'Portfolio checked — review account history before a new session',
    });
}
export async function startSession(config: SessionConfig, legacyRunning: () => boolean) {
    if (snapshot.busy || snapshot.uncertain) throw new Error('Stop or reconcile the previous session first.');
    if (!navigator.locks)
        throw new Error('This browser cannot safely coordinate trading tabs. Use a browser with Web Locks support.');
    stopped = false;
    update({
        busy: true,
        status: 'Validating account and risk limits',
        error: undefined,
        pnl: 0,
        trades: 0,
        contractId: undefined,
        records: [],
    });
    try {
        await navigator.locks.request(`jodongo-trading-${config.account}`, { ifAvailable: true }, async lock => {
            if (!lock) throw new Error('Another trading tab is using this account.');
            const api = connection();
            const assertAccount = async () => {
                if (connection() !== api || !api_base.is_authorized || legacyRunning())
                    throw new Error('Connection or bot state changed. Review settings again.');
                const { balance } = await request({ balance: 1 });
                if (config.real !== !/^VRT/.test(config.account))
                    throw new Error('Account mode changed. Review the demo/real confirmation again.');
                if (balance?.loginid !== config.account || balance?.currency !== 'USD')
                    throw new Error('Account changed or is not denominated in USD.');
                const error = validateRisk(config.risk, Number(balance.balance));
                if (error) throw new Error(error);
                return Number(balance.balance);
            };
            await assertAccount();
            const supported = await supportedContracts(config.market.symbol);
            if (!supported.includes(config.contract))
                throw new Error('This one-tick strategy is unavailable for this market/account.');
            const { portfolio } = await request({ portfolio: 1 });
            if (!portfolio || !Array.isArray(portfolio.contracts))
                throw new Error('Could not verify existing account exposure.');
            if (portfolio.contracts.length)
                throw new Error('Settle existing contracts before starting an isolated risk session.');
            let pnl = 0,
                losses = 0,
                grossLoss = 0,
                trades = 0;
            while (!stopped && trades < config.risk.maxTrades) {
                if (pnl >= config.risk.takeProfit || pnl <= -config.risk.stopLoss) break;
                const stake = nextStake(config.risk, losses);
                if (!canExpose(stake, pnl, config.risk.stopLoss, grossLoss)) {
                    update({ status: 'Stopped at the maximum loss/exposure limit' });
                    break;
                }
                const balance = await assertAccount();
                if (stake > balance) throw new Error('Insufficient account balance for the next stake.');
                update({ status: `Requesting live proposal · ${stake.toFixed(2)} USD` });
                const { proposal } = await request(
                    proposalPayload(config.market.symbol, config.contract, config.barrier, stake)
                );
                if (
                    !Number.isFinite(config.minPayoutRatio) ||
                    !proposal?.id ||
                    !Number.isFinite(Number(proposal.ask_price)) ||
                    !Number.isFinite(Number(proposal.payout)) ||
                    !(Number(proposal.ask_price) > 0) ||
                    Number(proposal.ask_price) > stake + 1e-9 ||
                    !(Number(proposal.payout) / Number(proposal.ask_price) >= config.minPayoutRatio - 1e-9)
                )
                    throw new Error('Invalid or unexpectedly priced proposal.');
                if (stopped) break;
                await assertAccount();
                if (stopped) break;
                update({ status: 'Submitting one purchase — duplicate submissions blocked' });
                let buy;
                try {
                    ({ buy } = await request({ buy: proposal.id, price: stake }));
                } catch (error) {
                    update({ uncertain: true });
                    throw error;
                }
                if (!buy?.contract_id) {
                    update({ uncertain: true });
                    throw new Error('Purchase result could not be verified. Inspect account history.');
                }
                const id = Number(buy.contract_id);
                update({ contractId: id, status: `Contract ${id} open · awaiting settlement` });
                let settled: DerivResponse['proposal_open_contract'];
                const deadline = Date.now() + 120000;
                while (Date.now() < deadline) {
                    await pause();
                    if (connection() !== api) {
                        update({ uncertain: true });
                        throw new Error('Connection changed during an open contract. Reconcile portfolio/history.');
                    }
                    const { proposal_open_contract: contract } = await request({
                        proposal_open_contract: 1,
                        contract_id: id,
                    });
                    if (contract?.is_sold) {
                        settled = contract;
                        break;
                    }
                }
                if (!settled || !Number.isFinite(Number(settled.profit))) {
                    update({ uncertain: true });
                    throw new Error('Settlement is unknown. No further orders are permitted until reconciliation.');
                }
                const profit = Number(settled.profit);
                pnl = Math.round((pnl + profit) * 100) / 100;
                grossLoss += Math.max(0, -profit);
                losses = profit < 0 ? losses + 1 : 0;
                if (config.risk.multiplier === 1) losses = 0;
                trades++;
                update({
                    pnl,
                    trades,
                    contractId: undefined,
                    records: [{ id, profit }, ...snapshot.records].slice(0, 100),
                    status: 'Contract settled',
                });
                if (!config.repeat) break;
                await pause();
            }
            update({
                status: stopped ? 'Stopped — no further orders' : 'Session ended — trade count or risk limit reached',
            });
        });
    } catch (error) {
        update({ status: 'Trading stopped', error: error instanceof Error ? error.message : 'Trading failed.' });
    } finally {
        update({ busy: false });
    }
}
