import { useEffect, useState } from 'react';
import { useApiBase } from '@/hooks/useApiBase';
import { connection, type DerivResponse, type Market, request } from '@/services/trading/market';
import { frequencies, lastDigit } from '@/services/trading/strategy';
export default function DCircles({ markets }: { markets: Market[] }) {
    const [symbol, setSymbol] = useState('');
    const [quotes, setQuotes] = useState<number[]>([]);
    const [lastAt, setLastAt] = useState(0);
    const [error, setError] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const [now, setNow] = useState(Date.now());
    const { connectionStatus } = useApiBase();
    const market = markets.find(m => m.symbol === symbol) || markets[0];
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        let disposed = false,
            subscriptionId = '',
            observer: { unsubscribe: () => void } | undefined;
        setQuotes([]);
        setLastAt(0);
        setSubscribed(false);
        setError('');
        if (!market) return;
        let api: ReturnType<typeof connection>;
        try {
            api = connection();
            let previousEpoch = 0;
            observer = api.onMessage().subscribe((message: unknown) => {
                const tick = (message as { data?: DerivResponse }).data?.tick;
                if (
                    disposed ||
                    !tick ||
                    tick.symbol !== market.symbol ||
                    !Number.isFinite(Number(tick.quote)) ||
                    tick.epoch === previousEpoch
                )
                    return;
                previousEpoch = tick.epoch;
                setQuotes(values => [...values, Number(tick.quote)].slice(-500));
                setLastAt(Number(tick.epoch) * 1000);
            });
            request({ ticks: market.symbol, subscribe: 1 })
                .then(response => {
                    subscriptionId = response.subscription?.id;
                    if (disposed) {
                        if (subscriptionId) void api.send({ forget: subscriptionId });
                        return;
                    }
                    setSubscribed(true);
                    if (response.tick && !previousEpoch) {
                        previousEpoch = response.tick.epoch;
                        setQuotes([Number(response.tick.quote)]);
                        setLastAt(response.tick.epoch * 1000);
                    }
                })
                .catch(err => {
                    if (!disposed) setError(err.message);
                });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection unavailable.');
        }
        return () => {
            disposed = true;
            observer?.unsubscribe();
            if (subscriptionId && Number(api?.connection?.readyState) === 1) void api.send({ forget: subscriptionId });
        };
    }, [market, connectionStatus]);
    const counts = market ? frequencies(quotes, market.precision) : Array<number>(10).fill(0);
    const digit = market && quotes.length ? lastDigit(quotes[quotes.length - 1], market.precision) : null;
    const live = subscribed && now - lastAt < 15000 && connectionStatus === 'opened';
    return (
        <section className='jt-page'>
            <p className='jt-eyebrow'>LIVE DIGIT OBSERVATORY</p>
            <div className='jt-title-row'>
                <div>
                    <h1>DCircles</h1>
                    <p className='jt-lead'>Every digit comes from a real Deriv market tick.</p>
                </div>
                <span className={`jt-badge ${live ? 'jt-live' : ''}`}>
                    {live ? 'Live stream' : subscribed ? 'Waiting / stale ticks' : 'Connecting'}
                </span>
            </div>
            <div className='jt-split'>
                <div className='jt-card'>
                    <label>
                        Volatility market
                        <select value={market?.symbol || ''} onChange={e => setSymbol(e.target.value)}>
                            {markets.map(m => (
                                <option key={m.symbol} value={m.symbol}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {error && (
                        <p className='jt-danger' role='alert'>
                            {error}
                        </p>
                    )}
                    <div className='jt-digit-circle'>
                        <div className='jt-digit-center'>
                            <span>LAST DIGIT</span>
                            <strong>{digit ?? '—'}</strong>
                            <small>
                                {quotes.length
                                    ? quotes[quotes.length - 1].toFixed(market!.precision)
                                    : 'Awaiting real ticks'}
                            </small>
                        </div>
                        {counts.map((count, value) => (
                            <div
                                key={value}
                                className={`jt-digit ${digit === value ? 'jt-digit-active' : ''}`}
                                style={{ '--angle': `${value * 36 - 90}deg` } as React.CSSProperties}
                            >
                                <strong>{value}</strong>
                                <small>{quotes.length ? `${((count / quotes.length) * 100).toFixed(1)}%` : '—'}</small>
                            </div>
                        ))}
                    </div>
                    <p className='jt-note'>
                        Rolling window: {quotes.length} / 500 ticks · Last tick:{' '}
                        {lastAt ? new Date(lastAt).toLocaleTimeString() : '—'}
                    </p>
                </div>
                <div className='jt-card'>
                    <h2>Last-digit frequency</h2>
                    <p className='jt-note'>
                        Historical counts describe this sample; they do not predict the next tick.
                    </p>
                    <table>
                        <thead>
                            <tr>
                                <th>Digit</th>
                                <th>Ticks</th>
                                <th>Frequency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {counts.map((count, value) => (
                                <tr key={value}>
                                    <td>{value}</td>
                                    <td>{count}</td>
                                    <td>
                                        <div className='jt-frequency'>
                                            <span
                                                style={{
                                                    width: `${quotes.length ? (count / quotes.length) * 100 : 0}%`,
                                                }}
                                            />
                                        </div>
                                        {quotes.length ? `${((count / quotes.length) * 100).toFixed(2)}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
