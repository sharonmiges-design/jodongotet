import React from 'react';
import { observer } from 'mobx-react-lite';

const NAV_ITEMS = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Free Bots', href: '/dashboard#free-bots' },
    { name: 'Premium Bots', href: '/premium-bots' },
    { name: 'Bot Builder', href: '/bot-builder' },
    { name: 'DCircles', href: '/dcircles' },
    { name: 'Speed Lab', href: '/speed-lab' },
    { name: 'Pro Hedge', href: '/pro-hedge' },
    { name: 'Charts', href: '/charts' },
];

export const MenuItems = observer(() => {
    return (
        <nav
            aria-label='Jodongo Tet navigation'
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                overflowX: 'auto',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                padding: '8px',
            }}
        >
            {NAV_ITEMS.map(item => (
                <a
                    key={item.name}
                    href={item.href}
                    style={{
                        color: 'inherit',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '8px 4px',
                    }}
                >
                    {item.name}
                </a>
            ))}
        </nav>
    );
});

export const TradershubLink = observer(() => {
    return null;
});

type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};

(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
export default MenuItems as MenuItemsType;
// [/AI]
