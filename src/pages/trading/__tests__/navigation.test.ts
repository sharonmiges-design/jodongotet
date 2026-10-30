import { PLATFORM_PAGES } from '../navigation';
it('exposes all twelve requested sections with unique destinations', () => {
    expect(PLATFORM_PAGES.map(page => page.name)).toEqual([
        'Dashboard',
        'Free Bots',
        'Premium Bots',
        'Bot Builder',
        'DCircles',
        'Speed Lab',
        'Pro Hedge',
        'Risk Calculator',
        'Charts',
        'Manual Trade',
        'Tutorials',
        'Copy Trading',
    ]);
    expect(new Set(PLATFORM_PAGES.map(p => p.hash)).size).toBe(12);
    expect(new Set(PLATFORM_PAGES.map(p => p.tab)).size).toBe(12);
});
it('preserves numeric tab contracts used by the existing workspace', () => {
    expect(PLATFORM_PAGES.filter(p => p.tab < 4).map(p => [p.hash, p.tab])).toEqual([
        ['dashboard', 0],
        ['bot_builder', 1],
        ['chart', 2],
        ['tutorial', 3],
    ]);
});
