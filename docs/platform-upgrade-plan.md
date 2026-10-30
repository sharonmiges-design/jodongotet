# JODONGO TET upgrade plan

The repository was inspected before application code was changed. The initial review found React 19, TypeScript, Rsbuild, MobX, four hash-based navigation tabs, a Blockly builder, browser-saved XML bots, charts, tutorials, OAuth with PKCE/state validation, authenticated Deriv OTP WebSockets, account switching, balances, and a proposal/purchase engine. Baseline targeted tests passed, while TypeScript reported a duplicate default export in the header menu.

The user selected Auto Pilot operation only while the trading tab stays open. The implementation sequence was:

1. Repair the baseline export error and retain existing numeric tab IDs, workspace formats, OAuth, chart integration, and import/export paths.
2. Introduce a shared navigation registry for twelve top-level destinations, preserve direct URLs and existing hashes, and give unfinished pages clear Coming Soon states.
3. Extract the dashboard calculator into Risk Calculator; retain the saved-bot dashboard and add an explicit account-isolated cloud library without assigning ownership of existing browser files.
4. Introduce typed live-market adapters, quote-precision digit extraction, real subscriptions, stale/error states, and deterministic, documented scanner criteria. Never synthesize market results.
5. Build DCircles and a draggable, accessible scanner with Smart Scan and Auto Pilot modes. Scanning remains separate from review and execution.
6. Implement compatible one-tick bot sessions, proposal review, explicit demo/real confirmation, loss/exposure budgets, bounded recovery, trade limits, same-browser account locks, stop controls, and settlement reconciliation. Remove automatic retries of non-idempotent purchases in the existing engine.
7. Reduce credential persistence, redact sensitive transport logging, and verify Deriv ownership server-side for all account-library records. Use managed Postgres and Drizzle migrations for new persistent records.
8. Validate TypeScript, focused lint, the complete test suite, stylesheet syntax, live public Deriv requests, and desktop/mobile behavior through a local source development server. Do not use deployments as a debugging loop.

The existing public-client OAuth flow was retained. A complete migration to server-managed HttpOnly sessions, cross-device order orchestration, premium billing/access, and unattended execution were not silently substituted into this upgrade. See `trading-safety.md` for implemented limits and outstanding authenticated demo checks.
