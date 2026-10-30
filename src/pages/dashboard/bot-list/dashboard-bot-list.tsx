// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { getSavedWorkspaces } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import DeleteDialog from './delete-dialog';
import RecentWorkspace from './recent-workspace';
import './index.scss';

type THeader = {
    label: string;
    className: string;
};

const HEADERS: THeader[] = [
    {
        label: localize('Bot name'),
        className: 'bot-list__header__label',
    },
    {
        label: localize('Last modified'),
        className: 'bot-list__header__time-stamp',
    },
    {
        label: localize('Status'),
        className: 'bot-list__header__load-type',
    },
];

const FREE_BOTS = [
    {
        id: 'rise-fall',
        name: 'Rise & Fall',
        description: 'Explore Rise and Fall trading strategies.',
    },
    {
        id: 'even-odd',
        name: 'Even & Odd',
        description: 'Explore Even and Odd digit strategies.',
    },
    {
        id: 'over-under',
        name: 'Over & Under',
        description: 'Explore Over and Under digit strategies.',
    },
    {
        id: 'matches-differs',
        name: 'Matches & Differs',
        description: 'Explore Matches and Differs digit strategies.',
    },
];

const DashboardBotList = observer(() => {
    const { load_modal, dashboard } = useStore();

    const { setDashboardStrategies, dashboard_strategies } = load_modal;

    const { setStrategySaveType, strategy_save_type } = dashboard;

    const { isDesktop } = useDevice();

    const get_first_strategy_info = React.useRef(false);
    const get_instacee = React.useRef(false);

    React.useEffect(() => {
        setStrategySaveType('');

        const getStrategies = async () => {
            const recent_strategies = await getSavedWorkspaces();

            setDashboardStrategies(recent_strategies);

            if (!get_instacee.current) {
                get_instacee.current = true;
            }
        };

        getStrategies();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategy_save_type]);

    React.useEffect(() => {
        if (
            !dashboard_strategies?.length &&
            !get_first_strategy_info.current
        ) {
            get_first_strategy_info.current = true;
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className='bot-list__container'>

            {/* FREE BOTS SECTION */}

            <div
                style={{
                    padding: '20px',
                    marginBottom: '24px',
                    borderRadius: '12px',
                    backgroundColor: '#f7f8fa',
                }}
            >
                <h2
                    style={{
                        fontSize: '22px',
                        fontWeight: 'bold',
                        marginBottom: '8px',
                    }}
                >
                    Jodongo Tet Free Bots
                </h2>

                <p
                    style={{
                        marginBottom: '20px',
                        fontSize: '14px',
                    }}
                >
                    Explore our free trading bot strategies.
                    Bot loading will be available soon.
                </p>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                    }}
                >
                    {FREE_BOTS.map(bot => (
                        <div
                            key={bot.id}
                            style={{
                                padding: '20px',
                                backgroundColor: '#ffffff',
                                borderRadius: '10px',
                                border: '1px solid #dddddd',
                            }}
                        >
                            <h3
                                style={{
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    marginBottom: '10px',
                                }}
                            >
                                {bot.name}
                            </h3>

                            <p
                                style={{
                                    fontSize: '14px',
                                    marginBottom: '16px',
                                }}
                            >
                                {bot.description}
                            </p>

                            <button
                                type='button'
                                disabled
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#cccccc',
                                    color: '#333333',
                                    cursor: 'not-allowed',
                                    width: '100%',
                                }}
                            >
                                Load Bot — Coming Soon
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* SAVED BOTS SECTION */}

            {dashboard_strategies?.length > 0 && (
                <div className='bot-list__wrapper'>

                    <div className='bot-list__title'>
                        <Text
                            size={isDesktop ? 's' : 'xs'}
                            weight='bold'
                        >
                            <Localize i18n_default_text='Your bots:' />
                        </Text>
                    </div>

                    <div className='bot-list__header'>
                        {HEADERS.map(({ label, className }) => {
                            return (
                                <div
                                    className={className}
                                    key={label}
                                >
                                    <Text
                                        size={isDesktop ? 'xs' : 'xxs'}
                                        weight='bold'
                                    >
                                        {label}
                                    </Text>
                                </div>
                            );
                        })}
                    </div>

                    <div className='bot-list__table'>
                        {dashboard_strategies.map(workspace => (
                            <RecentWorkspace
                                key={workspace.id}
                                workspace={workspace}
                            />
                        ))}
                    </div>

                </div>
            )}

            <DeleteDialog />

        </div>
    );
});

export default DashboardBotList;
