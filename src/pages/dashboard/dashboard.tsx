import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

import OnboardTourHandler from '../tutorials/dbot-tours/onboarding-tour';
import Announcements from './announcements';
import Cards from './cards';
import InfoPanel from './info-panel';

type TMobileIconGuide = {
    handleTabChange: (active_number: number) => void;
};

const DashboardComponent = observer(
    ({ handleTabChange }: TMobileIconGuide) => {
        const { load_modal, dashboard, client, google_drive } = useStore();

        const { dashboard_strategies } = load_modal;
        const { is_google_drive_configured } = google_drive;
        const { active_tab, active_tour } = dashboard;

        const has_dashboard_strategies = !!dashboard_strategies?.length;

        const { isDesktop, isTablet } = useDevice();

        // Trading calculator
        const [stake, setStake] = React.useState('1');
        const [payout, setPayout] = React.useState('1.95');

        const stakeAmount = Number(stake);
        const payoutAmount = Number(payout);

        const isValid =
            Number.isFinite(stakeAmount) &&
            Number.isFinite(payoutAmount) &&
            stakeAmount > 0 &&
            payoutAmount >= 0;

        const potentialProfit = payoutAmount - stakeAmount;

        const formatAmount = (value: number) =>
            value.toFixed(2);

        return (
            <React.Fragment>
                <div
                    className={classNames('tab__dashboard', {
                        'tab__dashboard--tour-active': active_tour,
                    })}
                >
                    <div className='tab__dashboard__content'>

                        {client.is_logged_in && (
                            <Announcements
                                is_mobile={!isDesktop}
                                is_tablet={isTablet}
                                handleTabChange={handleTabChange}
                            />
                        )}

                        {/* ORIGINAL DERIV DASHBOARD */}

                        <div className='quick-panel'>
                            <div
                                className={classNames(
                                    'tab__dashboard__header',
                                    {
                                        'tab__dashboard__header--listed':
                                            isDesktop &&
                                            has_dashboard_strategies,
                                    }
                                )}
                            >
                                {!has_dashboard_strategies && (
                                    <Text
                                        className='title'
                                        as='h2'
                                        color='prominent'
                                        size={isDesktop ? 'sm' : 's'}
                                        lineHeight='xxl'
                                        weight='bold'
                                    >
                                        {localize(
                                            'Load or build your bot'
                                        )}
                                    </Text>
                                )}

                                <Text
                                    as='p'
                                    color='prominent'
                                    lineHeight='s'
                                    size={isDesktop ? 's' : 'xxs'}
                                    className={classNames(
                                        'subtitle',
                                        {
                                            'subtitle__has-list':
                                                has_dashboard_strategies,
                                        }
                                    )}
                                >
                                    {is_google_drive_configured
                                        ? localize(
                                              'Import a bot from your computer or Google Drive, build it from scratch, or start with a quick strategy.'
                                          )
                                        : localize(
                                              'Import a bot from your computer, build it from scratch, or start with a quick strategy.'
                                          )}
                                </Text>
                            </div>

                            <Cards
                                has_dashboard_strategies={
                                    has_dashboard_strategies
                                }
                                is_mobile={!isDesktop}
                            />
                        </div>

                        {/* NEW ANALYSIS TOOLS */}

                        <section
                            style={{
                                background: '#101827',
                                color: '#ffffff',
                                borderRadius: '16px',
                                padding: '24px',
                                margin: '24px 0',
                            }}
                        >
                            <h2
                                style={{
                                    fontSize: '26px',
                                    fontWeight: 700,
                                    marginBottom: '8px',
                                }}
                            >
                                📊 Jodongo Tet Analysis Tools
                            </h2>

                            <p
                                style={{
                                    color: '#b8c5d6',
                                    marginBottom: '24px',
                                }}
                            >
                                Calculate your potential trading
                                profit and loss before placing a trade.
                            </p>

                            <div
                                style={{
                                    background: '#1b2738',
                                    padding: '20px',
                                    borderRadius: '12px',
                                    border: '1px solid #344156',
                                    maxWidth: '500px',
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: '20px',
                                        marginBottom: '20px',
                                    }}
                                >
                                    💰 Trading Calculator
                                </h3>

                                <label
                                    htmlFor='jodongo-stake'
                                    style={{
                                        display: 'block',
                                        marginBottom: '8px',
                                    }}
                                >
                                    Stake Amount
                                </label>

                                <input
                                    id='jodongo-stake'
                                    type='number'
                                    min='0.01'
                                    step='0.01'
                                    value={stake}
                                    onChange={event =>
                                        setStake(event.target.value)
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: '1px solid #526277',
                                        marginBottom: '20px',
                                        boxSizing: 'border-box',
                                        color: '#111827',
                                        background: '#ffffff',
