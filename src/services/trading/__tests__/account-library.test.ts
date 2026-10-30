/** @jest-environment node */
import { validateBot, verifyAccount } from '../../../../netlify/functions/lib/deriv-account';
const fetchMock = jest.fn();
beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
});
// Deliberately uses a non-credential test fixture; no real authorization data is logged.
function request(account = 'VRTC123', origin = 'https://example.test') {
    return new Request('https://example.test/.netlify/functions/bot-library', {
        headers: { Authorization: 'Bearer test-fixture', 'X-Deriv-Account': account, Origin: origin },
    });
}
it('rejects anonymous requests before querying Deriv', async () => {
    await expect(verifyAccount(new Request('https://example.test/library'))).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
});
it('rejects cross-origin requests', async () => {
    await expect(verifyAccount(request('VRTC123', 'https://untrusted.test'))).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
});
it('verifies requested account ownership using the upstream account list', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ account_id: 'VRTC123', status: 'active' }] }));
    await expect(verifyAccount(request())).resolves.toBe('VRTC123');
});
it('rejects another users account even with valid authentication', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ account_id: 'VRTC999', status: 'active' }] }));
    await expect(verifyAccount(request())).rejects.toMatchObject({ status: 403 });
});
it('does not expose upstream error bodies', async () => {
    fetchMock.mockResolvedValue(new Response('private-upstream-details', { status: 401 }));
    await expect(verifyAccount(request())).rejects.toMatchObject({
        status: 401,
        message: 'Deriv could not verify this account. Please reconnect.',
    });
});
it('accepts bounded Blockly documents', () => {
    expect(validateBot({ name: '  Digits  ', xml: '<xml><block type="trade_definition" /></xml>' }).name).toBe(
        'Digits'
    );
});
it.each(['<!DOCTYPE xml><xml />', '<xml><script>alert(1)</script></xml>', '<html />', 'x'.repeat(1000001)])(
    'rejects an unsafe or oversized document',
    xml => {
        expect(() => validateBot({ name: 'Bot', xml })).toThrow();
    }
);
