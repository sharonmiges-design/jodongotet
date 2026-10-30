import { clearAuthInfo, getAuthInfo, storeAuthInfo } from '@/external/deriv-core/auth/storage';
const fixture = {
    access_token: 'test-fixture',
    refresh_token: 'test-fixture',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    scope: 'trade',
};
beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
});
it('keeps OAuth credentials in the tab session rather than persistent storage', () => {
    storeAuthInfo(fixture);
    expect(localStorage.getItem('auth_info')).toBeNull();
    expect(getAuthInfo()).toEqual(fixture);
});
it('migrates an existing authenticated session without retaining the persistent copy', () => {
    localStorage.setItem('auth_info', JSON.stringify(fixture));
    expect(getAuthInfo()).toEqual(fixture);
    expect(localStorage.getItem('auth_info')).toBeNull();
});
it('rejects expired or malformed stored sessions without leaking parser details', () => {
    sessionStorage.setItem('auth_info', '{broken');
    expect(getAuthInfo()).toBeNull();
    storeAuthInfo({ ...fixture, expires_at: 1 });
    expect(getAuthInfo()).toBeNull();
});
it('clears both legacy and current storage on logout', () => {
    storeAuthInfo(fixture);
    localStorage.setItem('auth_info', JSON.stringify(fixture));
    clearAuthInfo();
    expect(getAuthInfo()).toBeNull();
    expect(localStorage.getItem('auth_info')).toBeNull();
});
