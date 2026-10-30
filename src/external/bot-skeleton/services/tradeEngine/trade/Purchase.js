import { holdSession, sessionSnapshot } from '@/services/trading/session';
import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { getUUID, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let purchase_reference;

export default Engine =>
    class Purchase extends Engine {
        async purchase(contract_type) {
            if (this.purchase_pending) return;
            if (sessionSnapshot().busy || sessionSnapshot().uncertain) throw new Error('Stop or reconcile the scanner trading session before running another bot.');
            if (!navigator.locks) throw new Error('Safe trading requires browser Web Locks support.');
            const account = api_base.account_info?.loginid;
            if (!account || !api_base.is_authorized) throw new Error('A verified Deriv account is required.');
            const amount = Number(this.tradeOptions?.amount);
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Stake must be a finite positive amount.');
            if ((!this.real_money_approved_for || this.real_money_approved_for !== this.startPromise) && !/^VRT/.test(account)) {
                if (!window.confirm(`Authorize REAL-MONEY bot trading on ${account}? Current stake: ${amount} ${api_base.account_info.currency}. Review the bot's maximum stake, take-profit and stop-loss blocks. Recovery can increase losses.`)) throw new Error('Real-money trading was not authorized.');
                this.real_money_approved_for = this.startPromise;
            }
            this.purchase_pending = true;
            try {
                return await navigator.locks.request(`jodongo-trading-${account}`, { ifAvailable: true }, async lock => {
                    if (!lock) throw new Error('Another tab is trading on this account.');
                    try { return await this.purchaseOnce(contract_type); }
                    catch (error) {
                        // A structured API rejection is known; transport failures require reconciliation.
                        if (!error?.error?.code) holdSession();
                        throw error;
                    }
                });
            } finally { this.purchase_pending = false; }
        }
        purchaseOnce(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            const onSuccess = response => {
                // Don't unnecessarily send a forget request for a purchased contract.
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());

                if (this.is_proposal_subscription_required) {
                    this.renewProposalsOnPurchase();
                }

                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            if (this.is_proposal_subscription_required) {
                const { id, askPrice } = this.selectProposal(contract_type);

                const action = () => api_base.api.send({ buy: id, price: askPrice });

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
                });

                if (!this.options.timeMachineEnabled) {
                    return action().then(onSuccess);
                }

                // A buy is not idempotent. Never replay it after a transport error.
                return action().then(onSuccess);
            }
            const trade_option = tradeOptionToBuy(contract_type, this.tradeOptions);
            const action = () => api_base.api.send(trade_option);

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
            });

            if (!this.options.timeMachineEnabled) {
                return action().then(onSuccess);
            }

            return action().then(onSuccess);
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
