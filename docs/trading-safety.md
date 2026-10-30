# JODONGO TET trading tools

The upgrade extends the existing application. Dashboard workspaces, XML import/export, Blockly, charts, tutorials, account switching, balances, and the existing transaction panel remain integrated. All twelve sections are available from the top navigation. The original four numeric tab IDs remain stable; additional sections use IDs 4–11. Direct section URLs and hash links both resolve to the workspace.

## Market data and scanner rules

DCircles streams real Deriv ticks and displays frequencies over the latest 500 received ticks. Digits use the market's quote precision, including trailing zeros. Changing markets clears the sample. Disconnected or stale streams are labeled.

Smart Scan accepts 100–5,000 historical ticks per supported volatility market, defaulting to 500. Version 1 compares one-tick Over 4 and Under 5 candidates. Each candidate must have supported contracts, a complete recent sample, and a live proposal. Its score is the Wilson 95% lower bound on observed winning digits minus proposal break-even probability (ask price / total payout). Candidates sort by score, then market symbol and contract name. Selection requires a positive score. No qualifying market is a normal result.

These are descriptive statistics, not evidence of predictive advantage. Selection across multiple markets can overfit. There is no language-model inference, invented data, promised profit, or automatic purchase during scanning. A selected result opens configuration and proposal review. Results expire after two minutes; review quotes expire after 30 seconds.

## Bot sessions

Free Bots implement one-tick Rise/Fall, Even/Odd, Over/Under, and Matches/Differs contract rules. Actual market/account support is checked with Deriv. They are configurable contract strategies, not validated profitable trading systems. New bot sessions require a verified USD account; other currencies remain available in the existing builder. Login initially prefers an available demo account.

A session requires a live proposal and explicit confirmation. Real accounts show a distinct real-money confirmation. Execution requests a fresh proposal, rejects a worse payout ratio, and caps the purchase price at the configured stake.

Auto Pilot uses the same controller and accepts Over/Under scanner selections. It runs only while this trading tab remains open. Closing the scanner dialog does not stop a confirmed session: status and Stop Trading remain available outside the dialog.

Before every purchase, the controller checks the authenticated account, connection, existing bot activity, balance, stake, maximum stake, take-profit, stop-loss, recovery steps, trade count, and the full potential loss of the next stake. The stop-loss budget caps both net realized loss plus next exposure and cumulative losing-stake exposure. Recovery multiplies subsequent stakes after losses, rounds to cents, and stops at its finite caps. A multiplier never guarantees recovery.

Stop Trading prevents future entries. An already submitted order can still be accepted; accepted contracts remain visible until settlement. The controller does not pretend to cancel an irreversible purchase. Connection loss, account changes, logout, and page closure stop future entries. Trading does not automatically resume after reconnecting.

Browser Web Locks prevent overlapping bot execution across tabs of the same browser and origin. Legacy Blockly purchases use the same account lock, a synchronous pending flag, a real-money confirmation for each run, and no automatic buy retries. These controls do not coordinate independent devices or trades placed outside this application. Legacy imported bots retain their XML-defined risk rules; the new session budget does not rewrite arbitrary XML strategies.

Unknown purchase or settlement responses place the controller on hold. No buy is retried. Reconciliation fetches the Deriv portfolio and account statement and requires no open contracts before clearing the hold. The user must review the authoritative account history. Session UI history lasts for the open tab; Deriv retains contract history across reloads.

## Credentials and account libraries

Existing OAuth PKCE and state validation remain in use. OAuth credentials now use tab-scoped session storage instead of persistent local storage. Existing stored credentials migrate on access; expired or malformed sessions are rejected, and logout clears both locations. OTP WebSocket URLs and token-exchange response bodies are not logged. This remains a browser OAuth public client; no client secret is embedded. A future server-managed HttpOnly session architecture would be a separate coordinated auth migration.

The cloud library uses managed Postgres and Drizzle. Its endpoint verifies the supplied OAuth authorization with Deriv and checks that the requested account belongs to that authenticated user. Every query is account-scoped; responses are non-cacheable. XML documents and names are bounded, quotas are serialized in the database, and API errors do not expose SQL or authorization details. Credentials are not stored in the bot database.

Cloud access is explicit to avoid background function requests. Copying a browser bot into an account library is explicit, leaves the local original intact, and does not silently assign ownership of legacy shared-browser files. The existing browser library remains device-local. Cloud schema migrations are generated for deployment; they are not manually applied by this change.

## Verification and release limits

Run `npm run type-check`, `npm run lint:trading`, and `npm test -- --runInBand --coverage=false`. The new lint command covers the added trading and server modules; the repository-wide legacy code has not been declared lint-clean. Production build validation is handled by the platform rather than running a manual build or deployment.

Unit tests cover precision, statistical selection, stale and incomplete data, cancellation, bounded recovery, exposure limits, account mismatch, duplicate starts, stopping before submission, worse proposals, unknown purchases, account ownership, XML validation, and credential storage. Browser checks use the local source development server, real public Deriv data, and anonymous sessions.

An authenticated demo end-to-end check is still required for OAuth completion, server-backed account-library CRUD after migrations, balances, actual purchases, settlement history, and stop/risk behavior against an authorized account. No real-money trade was executed as validation. Passing mocked execution tests is not a substitute for that demo check.

Premium Bots, Speed Lab, Pro Hedge, Manual Trade, and Copy Trading intentionally display Coming Soon. Premium access control, subscriptions, billing, continuous background trading, and cross-device execution locks are not implemented.
