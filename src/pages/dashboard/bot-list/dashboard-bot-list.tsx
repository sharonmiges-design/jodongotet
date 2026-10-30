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
