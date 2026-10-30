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
import CloudLibrary from '../trading/cloud-library';

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

        return (
            <React.Fragment>
                <div
                    className={classNames('tab__dashboard', {
                        'tab__dashboard--tour-active': active_tour,
                    })}
                >
                    <div className='tab__dashboard__content'>
                        <section className='jt-dashboard-intro'><p className='jt-eyebrow'>YOUR TRADING WORKSPACE</p><h1>Welcome to JODONGO TET</h1><p>Build a strategy, study live markets, and keep your risk in view.</p><div className='jt-actions'><a className='jt-primary' href={`${window.location.search}#free_bots`}>Explore Free Bots</a><a className='jt-secondary' href={`${window.location.search}#risk_calculator`}>Plan your risk</a></div><small>Trading involves loss. Start with a demo account and review every session.</small></section>

                        {client.is_logged_in && (
                            <Announcements
                                is_mobile={!isDesktop}
                                is_tablet={isTablet}
                                handleTabChange={handleTabChange}
                            />
                        )}

                        <CloudLibrary onLoad={() => handleTabChange(1)} />

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
                                        {localize('Load or build your bot')}
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

                    </div>
                </div>

                <InfoPanel />

                {active_tab === 0 && (
                    <OnboardTourHandler
                        is_mobile={!isDesktop}
                    />
                )}
            </React.Fragment>
        );
    }
);

export default DashboardComponent;
