import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getAuthInfo } from '@/external/deriv-core';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { sessionSnapshot } from '@/services/trading/session';
type SavedBot = { id: string; name: string; xml: string; createdAt: string };
const CloudLibrary = observer(({ onLoad }: { onLoad: () => void }) => {
    const { load_modal, run_panel } = useStore();
    const { isAuthorized, activeLoginid } = useApiBase();
    const [bots, setBots] = useState<SavedBot[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const accountRef = useRef(activeLoginid);
    accountRef.current = activeLoginid;
    useEffect(() => {
        setBots([]);
        setError('');
        setLoaded(false);
    }, [activeLoginid]);
    const api = async (method = 'GET', body?: unknown, id?: string) => {
        const auth = getAuthInfo();
        if (!auth?.access_token) throw new Error('Reconnect to Deriv to open your account library.');
        const response = await fetch(`/.netlify/functions/bot-library${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
            method,
            headers: {
                Authorization: `Bearer ${auth.access_token}`,
                'X-Deriv-Account': activeLoginid,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Account library is unavailable.');
        return data;
    };
    const perform = async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Library request failed.');
        } finally {
            setBusy(false);
        }
    };
    const refresh = async () => {
        const account = activeLoginid;
        const data = await api();
        if (accountRef.current === account) {
            setBots(data.bots);
            setLoaded(true);
        }
    };
    const saveSelected = async () => {
        const bot = load_modal.selected_strategy;
        if (!bot?.xml) throw new Error('Select an existing saved bot in the browser library below first.');
        await api('POST', { name: bot.name, xml: bot.xml });
        await refresh();
    };
    return (
        <section className='jt-card jt-cloud-library'>
            <p className='jt-eyebrow'>ACCOUNT-ISOLATED STORAGE</p>
            <h2>Cloud bot library</h2>
            <p className='jt-note'>
                Saved separately for each verified Deriv account. Existing browser bots remain below; copying one here
                requires an explicit action.
            </p>
            {isAuthorized ? (
                <>
                    <div className='jt-actions'>
                        <button className='jt-secondary' disabled={busy} onClick={() => perform(refresh)}>
                            {busy ? 'Working…' : loaded ? 'Refresh account library' : 'Open account library'}
                        </button>
                        <button
                            className='jt-secondary'
                            disabled={busy || !load_modal.selected_strategy?.xml}
                            onClick={() => perform(saveSelected)}
                        >
                            Copy selected browser bot to this account
                        </button>
                    </div>
                    {loaded && !bots.length && <p className='jt-note'>No cloud bots saved for this account yet.</p>}
                    {bots.map(bot => (
                        <div key={bot.id} className='jt-cloud-row'>
                            <div>
                                <strong>{bot.name}</strong>
                                <small>{new Date(bot.createdAt).toLocaleDateString()}</small>
                            </div>
                            <button
                                className='jt-secondary'
                                disabled={
                                    busy ||
                                    run_panel.is_running ||
                                    run_panel.has_open_contract ||
                                    sessionSnapshot().busy
                                }
                                onClick={() =>
                                    perform(async () => {
                                        const xml = new DOMParser().parseFromString(bot.xml, 'application/xml');
                                        if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'xml')
                                            throw new Error('This bot contains invalid Blockly XML.');
                                        await load_modal.loadStrategyToBuilder({
                                            ...bot,
                                            timestamp: new Date(bot.createdAt).getTime(),
                                            save_type: 'local',
                                        });
                                        onLoad();
                                    })
                                }
                            >
                                Load in Bot Builder
                            </button>
                            <button
                                className='jt-secondary'
                                disabled={busy}
                                onClick={() =>
                                    perform(async () => {
                                        if (
                                            !window.confirm(
                                                `Remove “${bot.name}” from this account's cloud library? Browser copies remain available.`
                                            )
                                        )
                                            return;
                                        await api('DELETE', undefined, bot.id);
                                        await refresh();
                                    })
                                }
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </>
            ) : (
                <p className='jt-note'>Log in to Deriv to access account-specific saved bots.</p>
            )}
            {error && (
                <p className='jt-warning' role='alert'>
                    {error}
                </p>
            )}
        </section>
    );
});
export default CloudLibrary;
