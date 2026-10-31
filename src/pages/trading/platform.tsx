import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { useApiBase } from '@/hooks/useApiBase';
import {
    type Market,
    proposalPayload,
    request,
    scanMarkets,
    type ScanResult,
    supportedContracts,
} from '@/services/trading/market';
import {
    reconcileSession,
    type SessionConfig,
    sessionSnapshot,
    startSession,
    stopSession,
    subscribeSession,
} from '@/services/trading/session';
import {
    BOT_FAMILIES,
    type Contract,
    CONTRACT_LABELS,
    DEFAULT_RISK,
    type RiskSettings,
    validateRisk,
} from '@/services/trading/strategy';
import DCircles from './dcircles';
import { PLATFORM_PAGES } from './navigation';
import RiskCalculator from './risk-calculator';
import { useMarkets } from './use-markets';
import './trading.scss';
export { PLATFORM_PAGES } from './navigation';

type Ticket = {
    market?: Market;
    contract: Contract;
    barrier: number;
    risk: RiskSettings;
    repeat: boolean;
    source?: ScanResult;
};
type Tools = {
    markets: Market[];
    marketError: string;
    retry: () => void;
    openTicket: (ticket: Ticket) => void;
    openScanner: () => void;
};
const Context = createContext<Tools | null>(null);
function useTradingTools() {
    return useContext(Context)!;
}
export function TradingNavigation({ activeTab, onNavigate }: { activeTab: number; onNavigate: (tab: number) => void }) {
    const [expanded, setExpanded] = useState(false);
    const navigation = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = navigation.current;
        const workspace = element?.closest('.bot-dashboard') as HTMLElement | null;
        if (!element || !workspace) return;
        const measure = () => {
            const rect = element.getBoundingClientRect();
            workspace.style.setProperty('--jt-navigation-height', `${rect.height}px`);
            document.documentElement.style.setProperty('--jt-navigation-bottom', `${rect.bottom}px`);
            window.dispatchEvent(new Event('resize'));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        measure();
        return () => observer.disconnect();
    }, []);
    return (
        <div className='jt-navigation' ref={navigation}>
            <div className='jt-nav-brand'>
                <span className='jt-monogram'>JT</span>
                <div>
                    JODONGO TET<small>TRADING WORKSPACE</small>
                </div>
                <button
                    className='jt-menu-toggle'
                    aria-expanded={expanded}
                    aria-controls='jt-nav-links'
                    onClick={() => setExpanded(!expanded)}
                >
                    Explore {expanded ? '−' : '+'}
                </button>
            </div>
            <nav id='jt-nav-links' aria-label='Trading sections' className={expanded ? 'is-expanded' : ''}>
                {PLATFORM_PAGES.map(page => (
                    <Link
                        key={page.hash}
                        to={`/${page.path}${window.location.search}`}
                        aria-current={activeTab === page.tab ? 'page' : undefined}
                        onClick={e => {
                            e.preventDefault();
                            onNavigate(page.tab);
                            setExpanded(false);
                        }}
                    >
                        {page.name}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
function RiskFields({ risk, onChange }: { risk: RiskSettings; onChange: (r: RiskSettings) => void }) {
    const fields: [keyof RiskSettings, string, number, number, number][] = [
        ['stake', 'Base Stake (USD)', 0.35, 100000, 0.01],
        ['multiplier', 'Recovery Multiplier', 1, 5, 0.1],
        ['takeProfit', 'Take Profit (USD)', 0.01, 100000, 0.01],
        ['stopLoss', 'Stop Loss / Total Loss Budget (USD)', 0.35, 100000, 0.01],
        ['maxStake', 'Maximum Stake (USD)', 0.35, 100000, 0.01],
        ['maxSteps', 'Maximum Recovery Steps', 0, 10, 1],
        ['maxTrades', 'Maximum Trades', 1, 100, 1],
    ];
    return (
        <>
            <div className='jt-fields'>
                {fields.map(([key, label, min, max, step]) => (
                    <label key={key}>
                        {label}
                        <input
                            type='number'
                            value={Number.isNaN(risk[key]) ? '' : risk[key]}
                            min={min}
                            max={max}
                            step={step}
                            onChange={e =>
                                onChange({ ...risk, [key]: e.target.value === '' ? NaN : Number(e.target.value) })
                            }
                        />
                    </label>
                ))}
            </div>
            <p className='jt-warning'>
                Recovery can accelerate losses. The multiplier does not guarantee recovery. Orders stop before the next
                stake exceeds your maximum stake, net loss limit, or cumulative losing-stake budget. No unattended
                trading.
            </p>
        </>
    );
}
function Scanner({ onTicket }: { onTicket: (ticket: Ticket) => void }) {
    const { markets, marketError, retry } = useTradingTools();
    const [mode, setMode] = useState<'smart' | 'auto'>('smart');
    const [ticks, setTicks] = useState(500);
    const [risk, setRisk] = useState(DEFAULT_RISK);
    const [strategy, setStrategy] = useState<'both' | 'DIGITOVER' | 'DIGITUNDER'>('both');
    const [results, setResults] = useState<ScanResult[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [progress, setProgress] = useState({ done: 0, total: 0, message: 'Ready for live market analysis' });
    const [busy, setBusy] = useState(false);
    const [completed, setCompleted] = useState(false);
    const abort = useRef<AbortController | null>(null);
    useEffect(() => () => abort.current?.abort(), []);
    const run = async () => {
        if (busy) return;
        setCompleted(false);
        setBusy(true);
        setResults([]);
        setErrors([]);
        const controller = new AbortController();
        abort.current = controller;
        try {
            const data = await scanMarkets(markets, ticks, controller.signal, (done, total, message) =>
                setProgress({ done, total, message })
            );
            setResults(data.results);
            setErrors(data.errors);
            setCompleted(true);
        } catch (err) {
            setErrors([err instanceof Error ? err.message : 'Scan failed.']);
        } finally {
            setBusy(false);
        }
    };
    const eligible = results.filter(r => strategy === 'both' || r.contract === strategy);
    const selected = eligible.find(r => r.score > 0);
    return (
        <>
            <p className='jt-eyebrow'>DATA FIRST · EXECUTION BY CONSENT</p>
            <h2 id='jt-modal-title'>AI Scanner</h2>
            <p className='jt-note'>
                A transparent statistical scanner. It uses Deriv data and fixed rules, not an AI profit prediction.
            </p>
            <div className='jt-segment' role='group' aria-label='Scanner mode'>
                <button
                    aria-pressed={mode === 'smart'}
                    disabled={busy}
                    onClick={() => {
                        setMode('smart');
                    }}
                >
                    SMART SCAN
                </button>
                <button
                    aria-pressed={mode === 'auto'}
                    disabled={busy}
                    onClick={() => {
                        setMode('auto');
                    }}
                >
                    AUTO PILOT
                </button>
            </div>
            <div className={`jt-radar ${busy ? 'is-scanning' : ''}`} aria-hidden='true'>
                <span />
                <i />
                <b>JT</b>
            </div>
            <label>
                Historical ticks per market (100–5,000)
                <input
                    type='number'
                    min={100}
                    max={5000}
                    step={1}
                    value={Number.isNaN(ticks) ? '' : ticks}
                    disabled={busy}
                    onChange={e => {
                        abort.current?.abort();
                        setResults([]);
                        setCompleted(false);
                        setTicks(e.target.value === '' ? NaN : Number(e.target.value));
                    }}
                />
            </label>
            <label>
                Over / Under strategy
                <select value={strategy} onChange={e => setStrategy(e.target.value as typeof strategy)} disabled={busy}>
                    <option value='both'>Compare both strategies</option>
                    <option value='DIGITOVER'>Over 4</option>
                    <option value='DIGITUNDER'>Under 5</option>
                </select>
            </label>
            {mode === 'auto' && (
                <div className='jt-card'>
                    <h3>Session settings</h3>
                    <RiskFields risk={risk} onChange={setRisk} />
                </div>
            )}
            {marketError && (
                <p className='jt-danger' role='alert'>
                    {marketError} <button onClick={retry}>Retry connection</button>
                </p>
            )}
            <button
                className='jt-primary jt-wide'
                disabled={busy || !markets.length || !Number.isInteger(ticks) || ticks < 100 || ticks > 5000}
                onClick={run}
            >
                {busy ? 'Reading live market data…' : mode === 'auto' ? 'Scan & Start' : 'Scan for Best Market'}
            </button>
            {busy && (
                <button className='jt-secondary' onClick={() => abort.current?.abort()}>
                    Cancel scan
                </button>
            )}
            <div role='status' className='jt-scan-progress'>
                <progress value={progress.done} max={progress.total || 1} />
                <p>{progress.message}</p>
            </div>
            {completed && (
                <div className='jt-card'>
                    <h3>{selected ? `Selected: ${selected.market.name}` : 'No qualifying market'}</h3>
                    {selected ? (
                        <>
                            <p>
                                {CONTRACT_LABELS[selected.contract]} {selected.barrier} · {selected.count} actual ticks
                                · {new Date(selected.timestamp).toLocaleTimeString()}
                            </p>
                            <p>
                                Observed wins: {(selected.observed * 100).toFixed(2)}% · 95% lower bound:{' '}
                                {(selected.lower * 100).toFixed(2)}% · Quote break-even:{' '}
                                {(selected.breakEven * 100).toFixed(2)}%
                            </p>
                            <button
                                className='jt-primary'
                                onClick={() =>
                                    onTicket({
                                        market: selected.market,
                                        contract: selected.contract,
                                        barrier: selected.barrier,
                                        risk: mode === 'auto' ? { ...risk } : { ...DEFAULT_RISK },
                                        repeat: mode === 'auto',
                                        source: selected,
                                    })
                                }
                            >
                                {mode === 'auto' ? 'Review Auto Pilot session' : 'Load and Run Bot'}
                            </button>
                            <p className='jt-note'>
                                Loading opens settings and a live proposal for review. No trade starts from this button.
                            </p>
                        </>
                    ) : (
                        <p>
                            No candidate has a 95% empirical lower bound above its quoted break-even rate. No bot is
                            started.
                        </p>
                    )}
                    <details>
                        <summary>Analysis criteria and market results ({eligible.length})</summary>
                        <p className='jt-note'>
                            Strategy v1: scan available volatility markets, request the selected sample, count digits
                            strictly over 4 or under 5, calculate the Wilson 95% lower bound, subtract live quote
                            break-even (ask ÷ payout), and rank by that difference. Ties sort by symbol and contract.
                            Selection requires a positive difference. Multiple-market selection can overfit; even a
                            qualifying historical sample provides no proven predictive advantage.
                        </p>
                        <div className='jt-table-scroll'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Market</th>
                                        <th>Strategy</th>
                                        <th>Observed</th>
                                        <th>Lower bound</th>
                                        <th>Break-even</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eligible.map(row => (
                                        <tr key={`${row.market.symbol}-${row.contract}`}>
                                            <td>{row.market.name}</td>
                                            <td>
                                                {CONTRACT_LABELS[row.contract]} {row.barrier}
                                            </td>
                                            <td>{(row.observed * 100).toFixed(2)}%</td>
                                            <td>{(row.lower * 100).toFixed(2)}%</td>
                                            <td>{(row.breakEven * 100).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </div>
            )}
            {errors.length > 0 && (
                <details className='jt-warning' open={!results.length}>
                    <summary>Unavailable markets / errors ({errors.length})</summary>
                    {errors.map((error, i) => (
                        <p key={i}>{error}</p>
                    ))}
                </details>
            )}
            <p className='jt-note'>
                Past frequencies do not predict future ticks. Trading may lose your entire session budget. Scanning
                never purchases a contract.
            </p>
        </>
    );
}
function TicketReview({
    ticket,
    onDone,
    legacyRunning,
}: {
    ticket: Ticket;
    onDone: () => void;
    legacyRunning: () => boolean;
}) {
    const { markets } = useTradingTools();
    const { authData, isAuthorized, activeLoginid, connectionStatus } = useApiBase();
    const [market, setMarket] = useState(ticket.market || markets[0]);
    const [contract, setContract] = useState<Contract>(ticket.contract);
    const [barrier, setBarrier] = useState(ticket.barrier);
    const [risk, setRisk] = useState({ ...ticket.risk });
    const [repeat, setRepeat] = useState(ticket.repeat);
    const [confirmed, setConfirmed] = useState(false);
    const [quote, setQuote] = useState<{ id: string; ask_price: number; payout: number } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [supported, setSupported] = useState<string[]>([]);
    const quoteAt = useRef(0);
    const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
    const real = !authData?.is_virtual;
    useEffect(() => {
        let disposed = false;
        setSupported([]);
        setError('');
        if (market)
            supportedContracts(market.symbol)
                .then(value => {
                    if (!disposed) setSupported(value);
                })
                .catch(err => {
                    if (!disposed) setError(err.message);
                });
        return () => {
            disposed = true;
        };
    }, [market, activeLoginid, connectionStatus]);
    useEffect(() => {
        setConfirmed(false);
        setQuote(null);
    }, [market, contract, barrier, risk, repeat, activeLoginid, connectionStatus]);
    const invalid = validateRisk(risk, Number(authData?.balance ?? 0));
    const barrierInvalid =
        !Number.isInteger(barrier) ||
        barrier < 0 ||
        barrier > 9 ||
        (contract === 'DIGITOVER' && barrier === 9) ||
        (contract === 'DIGITUNDER' && barrier === 0);
    const needsBarrier = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contract);
    const available = !!market && supported.includes(contract) && (!needsBarrier || !barrierInvalid);
    const getQuote = async () => {
        setLoading(true);
        setError('');
        setConfirmed(false);
        setQuote(null);
        try {
            if (!market || invalid) throw new Error(invalid || 'Choose an available market.');
            const response = await request(proposalPayload(market.symbol, contract, barrier, risk.stake));
            if (!response.proposal?.id || !(Number(response.proposal.payout) > 0))
                throw new Error('No valid proposal returned.');
            setQuote(response.proposal);
            quoteAt.current = Date.now();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Proposal failed.');
        } finally {
            setLoading(false);
        }
    };
    const start = async () => {
        if (!confirmed || !quote || !market || invalid || session.busy) return;
        if (Date.now() - quoteAt.current > 30000 || (ticket.source && Date.now() - ticket.source.timestamp > 120000)) {
            setError('Quote or scanner result expired. Rescan or refresh the proposal before confirming.');
            setConfirmed(false);
            setQuote(null);
            return;
        }
        const config: SessionConfig = {
            market,
            contract,
            barrier,
            risk: { ...risk },
            account: activeLoginid,
            real,
            repeat,
            minPayoutRatio: Number(quote.payout) / Number(quote.ask_price),
        };
        try {
            const promise = startSession(config, legacyRunning);
            onDone();
            await promise;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start session.');
        }
    };
    return (
        <>
            <p className='jt-eyebrow'>REVIEW BEFORE EXECUTION</p>
            <h2 id='jt-modal-title'>{repeat ? 'Auto Pilot' : 'Free Bot'} settings</h2>
            <div className={`jt-badge ${real ? 'jt-real' : 'jt-live'}`}>
                {isAuthorized
                    ? `${real ? 'REAL MONEY' : 'DEMO'} · ${activeLoginid} · ${authData?.currency}`
                    : 'Log in to a Deriv demo account to trade'}
            </div>
            <fieldset disabled={loading || session.busy}>
                <div className='jt-fields'>
                    <label>
                        Market
                        <select
                            value={market?.symbol || ''}
                            onChange={e => setMarket(markets.find(m => m.symbol === e.target.value))}
                        >
                            {markets.map(m => (
                                <option key={m.symbol} value={m.symbol}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Contract (one tick)
                        <select value={contract} onChange={e => setContract(e.target.value as Contract)}>
                            {Object.entries(CONTRACT_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                    {supported.includes(value) ? '' : ' · unavailable'}
                                </option>
                            ))}
                        </select>
                    </label>
                    {needsBarrier && (
                        <label>
                            Digit barrier
                            <input
                                type='number'
                                min={0}
                                max={9}
                                step={1}
                                value={barrier}
                                onChange={e => setBarrier(Number(e.target.value))}
                            />
                        </label>
                    )}
                </div>
                <label className='jt-check'>
                    <input type='checkbox' checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                    Repeat trades within the session limits
                </label>
                <RiskFields risk={risk} onChange={setRisk} />
            </fieldset>
            {invalid && isAuthorized && <p className='jt-warning'>{invalid}</p>}
            {!available && (
                <p className='jt-note'>
                    Select a contract and barrier supported by this market. Availability is checked with Deriv.
                </p>
            )}
            {authData?.currency && authData.currency !== 'USD' && (
                <p className='jt-warning'>These bot sessions support USD accounts. Switch to a USD demo account.</p>
            )}
            <button
                className='jt-secondary jt-wide'
                disabled={
                    loading || session.busy || !isAuthorized || authData?.currency !== 'USD' || !!invalid || !available
                }
                onClick={getQuote}
            >
                {loading ? 'Requesting proposal…' : 'Get live proposal for review'}
            </button>
            {quote && (
                <div className='jt-card'>
                    <h3>Live proposal · {CONTRACT_LABELS[contract]}</h3>
                    <p>
                        Stake: {Number(quote.ask_price).toFixed(2)} USD · Total payout:{' '}
                        {Number(quote.payout).toFixed(2)} USD · Potential profit:{' '}
                        {(Number(quote.payout) - Number(quote.ask_price)).toFixed(2)} USD
                    </p>
                    <p>
                        Maximum loss per trade: {Number(quote.ask_price).toFixed(2)} USD.{' '}
                        {repeat
                            ? `Up to ${risk.maxTrades} trades; cumulative losses limited to ${risk.stopLoss.toFixed(2)} USD.`
                            : 'One trade only.'}
                    </p>
                    <p className='jt-note'>
                        The execution controller requests a fresh proposal at submission. A worse payout ratio is
                        rejected; purchase price cannot exceed the configured stake.
                    </p>
                    <label className='jt-check'>
                        <input type='checkbox' checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                        {real
                            ? `I authorize REAL-MONEY trading on ${activeLoginid} with these settings and accept the risk of loss.`
                            : 'I confirm these demo trading settings and risk limits.'}
                    </label>
                    <button
                        className={`jt-primary jt-wide ${real ? 'jt-real-button' : ''}`}
                        disabled={!confirmed || loading || session.busy || !!invalid || !available || !isAuthorized}
                        onClick={start}
                    >
                        {real ? 'Confirm real-money trading' : 'Confirm demo trading'}
                    </button>
                </div>
            )}
            {error && (
                <p className='jt-danger' role='alert'>
                    {error}
                </p>
            )}
            <p className='jt-note'>
                Keep this tab open. Closing it prevents further entries; an accepted contract still settles at Deriv.
                Use Stop Trading to end entries immediately.
            </p>
        </>
    );
}
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    const dialog = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.current?.focus();
        const keydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
            if (e.key !== 'Tab') return;
            const elements = Array.from(
                dialog.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]'
                ) || []
            ).filter(el => el.getClientRects().length);
            const first = elements[0],
                last = elements[elements.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', keydown);
        return () => {
            document.removeEventListener('keydown', keydown);
            document.body.style.overflow = bodyOverflow;
            previous?.focus();
        };
    }, [onClose]);
    return createPortal(
        <div className='jt-overlay'>
            <div
                ref={dialog}
                className='jt-modal'
                role='dialog'
                aria-modal='true'
                aria-labelledby='jt-modal-title'
                tabIndex={-1}
            >
                <button className='jt-close' aria-label='Close trading tools' onClick={onClose}>
                    ×
                </button>
                {children}
            </div>
        </div>,
        document.body
    );
}
function FloatingAI({ onOpen }: { onOpen: () => void }) {
    const [position, setPosition] = useState({
        x: Math.max(8, window.innerWidth - 88),
        y: Math.max(8, window.innerHeight - 150),
    });
    const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
    useEffect(() => {
        const clamp = () => {
            if (window.innerWidth < 150 || window.innerHeight < 150) return;
            setPosition(pos => ({
                x: Math.max(8, Math.min(pos.x, window.innerWidth - 76)),
                y: Math.max(8, Math.min(pos.y, window.innerHeight - 76)),
            }));
        };
        window.addEventListener('resize', clamp);
        return () => window.removeEventListener('resize', clamp);
    }, []);
    return (
        <button
            className='jt-ai'
            aria-label='Open AI Scanner; drag to reposition'
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            onPointerDown={e => {
                if (e.button !== 0) return;
                drag.current = { x: e.clientX, y: e.clientY, originX: position.x, originY: position.y, moved: false };
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e => {
                const d = drag.current;
                if (!d) return;
                const dx = e.clientX - d.x,
                    dy = e.clientY - d.y;
                if (Math.hypot(dx, dy) > 5) d.moved = true;
                if (d.moved)
                    setPosition({
                        x: Math.max(8, Math.min(window.innerWidth - 76, d.originX + dx)),
                        y: Math.max(8, Math.min(window.innerHeight - 76, d.originY + dy)),
                    });
            }}
            onPointerUp={e => {
                if (!drag.current) return;
                e.currentTarget.releasePointerCapture(e.pointerId);
                if (!drag.current.moved) onOpen();
                drag.current = null;
            }}
            onPointerCancel={() => {
                drag.current = null;
            }}
            onClick={e => {
                if (e.detail === 0) onOpen();
            }}
        >
            <span>AI</span>
        </button>
    );
}
export function TradingPlatform({
    children,
    legacyRunning,
    onStopLegacy,
}: {
    children: React.ReactNode;
    legacyRunning: () => boolean;
    onStopLegacy: () => void;
}) {
    const { markets, error: marketError, retry } = useMarkets();
    const { authData, activeLoginid, connectionStatus, isAuthorized } = useApiBase();
    const [modal, setModal] = useState<'scanner' | 'ticket' | null>(null);
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
    const [reconcileError, setReconcileError] = useState('');
    const close = React.useCallback(() => setModal(null), []);
    const openTicket = (value: Ticket) => {
        setTicket(value);
        setModal('ticket');
    };
    const previousAccount = useRef(activeLoginid);
    useEffect(() => {
        if (previousAccount.current !== activeLoginid || connectionStatus !== 'opened' || !isAuthorized) stopSession();
        previousAccount.current = activeLoginid;
    }, [activeLoginid, connectionStatus, isAuthorized]);
    useEffect(() => {
        const stop = () => stopSession();
        const unload = (e: BeforeUnloadEvent) => {
            if (sessionSnapshot().busy) {
                stopSession();
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('pagehide', stop);
        window.addEventListener('beforeunload', unload);
        return () => {
            stopSession();
            window.removeEventListener('pagehide', stop);
            window.removeEventListener('beforeunload', unload);
        };
    }, []);
    return (
        <Context.Provider value={{ markets, marketError, retry, openTicket, openScanner: () => setModal('scanner') }}>
            <div className='jt-platform'>
                {children}
                <aside className='jt-session-dock' aria-label='Trading session controls'>
                    <div className='jt-session-bar' role='status'>
                        <span className={`jt-status-dot ${connectionStatus === 'opened' ? 'is-connected' : ''}`} />
                        <span>{connectionStatus === 'opened' ? 'Deriv connected' : 'Deriv disconnected'}</span>
                        <span className='jt-account-status'>
                            {isAuthorized
                                ? `${authData?.is_virtual ? 'DEMO' : 'REAL'} · ${activeLoginid}`
                                : 'Market data mode · log in for trading'}
                        </span>
                        <span>{session.status}</span>
                        {session.trades > 0 && (
                            <span>
                                {session.trades} trades · P&L {session.pnl.toFixed(2)} USD
                            </span>
                        )}
                        <button
                            className='jt-stop'
                            disabled={!session.busy && !legacyRunning()}
                            onClick={() => {
                                stopSession();
                                onStopLegacy();
                            }}
                        >
                            Stop Trading
                        </button>
                    </div>
                    {session.error && (
                        <div className='jt-session-error' role='alert'>
                            {session.error}
                            {session.uncertain && (
                                <button
                                    disabled={session.busy}
                                    onClick={() => {
                                        setReconcileError('');
                                        reconcileSession().catch(err => setReconcileError(err.message));
                                    }}
                                >
                                    Check portfolio & history
                                </button>
                            )}
                            {reconcileError && <p>{reconcileError}</p>}
                        </div>
                    )}
                    {session.records.length > 0 && (
                        <details className='jt-session-history'>
                            <summary>Session trading history · {session.records.length} settled contracts</summary>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Contract</th>
                                        <th>Profit / Loss (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {session.records.map(record => (
                                        <tr key={record.id}>
                                            <td>{record.id}</td>
                                            <td>{record.profit.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p>
                                Deriv retains the authoritative history. Use the existing Transactions panel for account
                                contract details.
                            </p>
                        </details>
                    )}
                </aside>
                <FloatingAI onOpen={() => setModal('scanner')} />
                {modal && (
                    <Modal onClose={close}>
                        {session.busy && (
                            <div className='jt-warning'>
                                <p role='status'>{session.status}</p>
                                <button className='jt-stop' onClick={stopSession}>
                                    Stop active trading session
                                </button>
                            </div>
                        )}
                        {modal === 'scanner' ? (
                            <Scanner onTicket={openTicket} />
                        ) : (
                            ticket && <TicketReview ticket={ticket} onDone={close} legacyRunning={legacyRunning} />
                        )}
                    </Modal>
                )}
            </div>
        </Context.Provider>
    );
}
export function ExtraPage({ tab }: { tab: number }) {
    const { markets, marketError, retry, openTicket, openScanner } = useTradingTools();
    if (tab === 9) return <RiskCalculator />;
    if (tab === 6)
        return (
            <>
                {marketError && (
                    <div className='jt-page jt-warning' role='alert'>
                        {marketError} <button onClick={retry}>Reconnect markets</button>
                    </div>
                )}
                <DCircles markets={markets} />
            </>
        );
    if (tab === 4)
        return (
            <section className='jt-page'>
                <p className='jt-eyebrow'>BUILD A DISCIPLINED SESSION</p>
                <div className='jt-title-row'>
                    <div>
                        <h1>Free Bots</h1>
                        <p className='jt-lead'>Configure a strategy. Review a live proposal. Confirm every session.</p>
                    </div>
                    <button className='jt-secondary' onClick={openScanner}>
                        Open market scanner
                    </button>
                </div>
                <p className='jt-warning'>
                    These are rule-based, one-tick contract strategies, not profit signals. Start on demo. Market and
                    account availability is checked before execution. Live trading validation remains subject to an
                    authenticated demo test.
                </p>
                {marketError && (
                    <p className='jt-danger'>
                        {marketError} <button onClick={retry}>Retry</button>
                    </p>
                )}
                <div className='jt-bot-grid'>
                    {BOT_FAMILIES.map((family, i) => (
                        <article className='jt-card jt-bot-card' key={family.name}>
                            <span className='jt-bot-number'>0{i + 1}</span>
                            <span className='jt-badge'>USD · DEMO FIRST</span>
                            <h2>{family.name}</h2>
                            <p>{family.description}</p>
                            <p className='jt-note'>One tick · configurable risk limits · manual or repeated session</p>
                            <button
                                className='jt-primary'
                                disabled={!markets.length}
                                onClick={() =>
                                    openTicket({
                                        contract: family.contracts[0],
                                        barrier: 4,
                                        risk: { ...DEFAULT_RISK },
                                        repeat: false,
                                    })
                                }
                            >
                                Configure strategy <span aria-hidden='true'>↗</span>
                            </button>
                        </article>
                    ))}
                </div>
            </section>
        );
    const page = PLATFORM_PAGES.find(page => page.tab === tab);
    const content = PAGE_CONTENT[tab];
    if (!page || !content) return null;
    return (
        <section className='jt-page'>
            <p className='jt-eyebrow'>{content.eyebrow}</p>
            <h1>{page.name}</h1>
            <p className='jt-lead'>{content.description}</p>
            <div className='jt-empty' role='status'>
                <div className='jt-empty-symbol' aria-hidden='true'>
                    {content.symbol}
                </div>
                <h2>{content.emptyTitle}</h2>
                <p>{content.emptyText}</p>
            </div>
        </section>
    );
}
const PAGE_CONTENT: Record<
    number,
    { eyebrow: string; description: string; symbol: string; emptyTitle: string; emptyText: string }
> = {
    5: {
        eyebrow: 'ADVANCED STRATEGIES',
        description: 'Premium strategies with extended configuration and risk controls.',
        symbol: '★',
        emptyTitle: 'No premium bots available',
        emptyText: 'Premium bots you have access to will be listed here.',
    },
    7: {
        eyebrow: 'FAST CONTRACT TESTING',
        description: 'Run and review short-duration contract experiments on a demo account.',
        symbol: '⚡',
        emptyTitle: 'No speed tests yet',
        emptyText: 'Your speed test sessions and their results will appear here.',
    },
    8: {
        eyebrow: 'POSITION HEDGING',
        description: 'Pair opposing contracts to manage exposure across a trading session.',
        symbol: '⇅',
        emptyTitle: 'No hedge positions',
        emptyText: 'Hedged contract pairs you open will appear here.',
    },
    10: {
        eyebrow: 'DIRECT EXECUTION',
        description: 'Place individual contracts on your connected Deriv account.',
        symbol: '↗',
        emptyTitle: 'No manual trades',
        emptyText: 'Contracts you place manually will be listed here.',
    },
    11: {
        eyebrow: 'FOLLOW TRADERS',
        description: 'Follow other traders and mirror their contracts on your account.',
        symbol: '⧉',
        emptyTitle: 'Not copying anyone yet',
        emptyText: 'Traders you follow and copied contracts will appear here.',
    },
};
