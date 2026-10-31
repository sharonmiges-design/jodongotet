import React from 'react';
import { Link, useRouteError } from 'react-router';
import { isPreviewMode, PREVIEW_BASE_PATH } from '@/utils/is-preview-mode';
import './route-fallbacks.scss';

const DASHBOARD_HREF = `${isPreviewMode() ? PREVIEW_BASE_PATH : ''}/dashboard`;

type FallbackProps = { eyebrow: string; title: string; message: string; children: React.ReactNode };

const FallbackPage = ({ eyebrow, title, message, children }: FallbackProps) => (
    <main className='jt-fallback'>
        <section className='jt-fallback__card'>
            <p className='jt-fallback__eyebrow'>{eyebrow}</p>
            <h1>{title}</h1>
            <p>{message}</p>
            <div className='jt-fallback__actions'>{children}</div>
        </section>
    </main>
);

/** Rendered for any path that does not match a workspace page. Lives inside the router. */
export const NotFoundPage = () => (
    <FallbackPage
        eyebrow='JODONGO TET · 404'
        title='Page not found'
        message='The page you are looking for does not exist or has moved. Use the button below to return to your workspace.'
    >
        <Link className='jt-fallback__primary' to='/dashboard'>
            Back to Dashboard
        </Link>
    </FallbackPage>
);

/** Friendly replacement for the router's raw error screen, and for errors thrown outside it. */
export const AppErrorPage = () => (
    <FallbackPage
        eyebrow='JODONGO TET'
        title='Something went wrong'
        message='This page could not be displayed. Your account and saved bots are unaffected. Reload the page or return to the Dashboard.'
    >
        <a className='jt-fallback__primary' href={DASHBOARD_HREF}>
            Back to Dashboard
        </a>
        <button className='jt-fallback__secondary' onClick={() => window.location.reload()}>
            Reload page
        </button>
    </FallbackPage>
);

/** Route-level errorElement: 404 responses get the Not Found page, everything else the generic error page. */
export const RouteErrorPage = () => {
    const error = useRouteError();
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) return <NotFoundPage />;
    if (error) console.error('Route error:', error);
    return <AppErrorPage />;
};

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { has_error: boolean }> {
    state = { has_error: false };

    static getDerivedStateFromError() {
        return { has_error: true };
    }

    componentDidCatch(error: unknown) {
        console.error('Application error:', error);
    }

    render() {
        return this.state.has_error ? <AppErrorPage /> : this.props.children;
    }
}
