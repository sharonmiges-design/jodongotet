import { useEffect, useState } from 'react';
import { useApiBase } from '@/hooks/useApiBase';
import { getMarkets, type Market } from '@/services/trading/market';
export function useMarkets() {
    const { connectionStatus } = useApiBase();
    const [markets, setMarkets] = useState<Market[]>([]);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let disposed = false;
        setMarkets([]);
        getMarkets()
            .then(data => {
                if (!disposed) {
                    setMarkets(data);
                    setError(data.length ? '' : 'No supported volatility markets are available.');
                }
            })
            .catch(err => {
                if (!disposed) setError(err.message);
            });
        return () => {
            disposed = true;
        };
    }, [connectionStatus, retry]);
    return { markets, error, retry: () => setRetry(value => value + 1) };
}
