export class RequestError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
    }
}
/** Validate OAuth access with Deriv itself. No JWT decoding or client-supplied ownership claims. */
export async function verifyAccount(req: Request): Promise<string> {
    const authorization = req.headers.get('authorization');
    const account = req.headers.get('x-deriv-account');
    if (!authorization?.startsWith('Bearer ') || !account || !/^[A-Za-z0-9_-]{1,64}$/.test(account)) {
        throw new RequestError(401, 'Log in to Deriv before opening your account library.');
    }
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
        throw new RequestError(403, 'Cross-origin requests are not permitted.');
    const response = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
        headers: {
            Authorization: authorization,
            ...(process.env.NEXT_PUBLIC_DERIV_APP_ID ? { 'Deriv-App-ID': process.env.NEXT_PUBLIC_DERIV_APP_ID } : {}),
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
        throw new RequestError(
            response.status === 401 || response.status === 403 ? 401 : 502,
            'Deriv could not verify this account. Please reconnect.'
        );
    const body = (await response.json()) as { data?: { account_id: string; status?: string }[] };
    if (!body.data?.some(item => item.account_id === account && (!item.status || item.status === 'active')))
        throw new RequestError(403, 'This account does not belong to the authenticated Deriv user.');
    return account;
}
export function validateBot(body: unknown): { name: string; xml: string } {
    if (!body || typeof body !== 'object') throw new RequestError(400, 'Invalid bot document.');
    const { name, xml } = body as { name?: unknown; xml?: unknown };
    if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.length > 100 ||
        typeof xml !== 'string' ||
        xml.length > 1000000 ||
        !/^\s*(?:<\?xml[^>]*>\s*)?<xml[\s>]/i.test(xml) ||
        /<!DOCTYPE|<!ENTITY|<script[\s>]/i.test(xml)
    ) {
        throw new RequestError(400, 'Use a name up to 100 characters and a Blockly XML document under 1 MB.');
    }
    return { name: name.trim(), xml };
}
