# Changelog

## 0.13.0 — 2026-09-09

### Workspace panel
- New **9Router** workspace panel (Projects, workspace tabs and the explorer, or "Show 9Router routing for this workspace" in the Command Center). The 0.12.0 panel was agent-context only, so nothing from the plugin appeared under Projects. The workspace panel shows whether per-agent routing is on, ready/resting/stuck account counts, the stuck accounts by name with their last error, and every pool's accounts with Reset backoff per account and a reset-all button.

### Composer pill
- A **9Router** pill above an agent's message box when there is something to act on: accounts resting or stuck in that agent's pool, no accounts ready, the router offline while routing is on, or an agent bypassing an enabled pool ("Not routed"). Healthy agents get no pill. Pressing it opens the 9Router accounts page. Off switch: **Show a 9Router pill in agent composers** in Routing settings.

### Automatic health checks
- A server-side poller refreshes account health on a timer (default every 10 minutes, 2 minutes to 2 hours) and caches the result; pills and the workspace panel read the cache through the new `routerRoutingHealth` RPC, which reports `checkedAt`, per-pool ready/resting/stuck counts and the stuck accounts.
- An active account at or past backoff level 5 is reported as **stuck**: logged once per episode, marked in red in every account list, and listed on the workspace panel. This is the state where an account sat at `backoffLevel: 15` with a 429, looked active, and left one account serving the whole pool.
- The timer is cleared when the plugin's server entry is torn down.

### Settings
- Routing settings document bumped to schema **version 2** with `healthChecks` (default on), `healthIntervalMinutes` (default 10) and `showComposerPill` (default on). A saved v1 document is upgraded in place, both by the host through `migrate` and by the server hooks when they read the file: routing choices survive and the new fields take their defaults. Only an unreadable document or an unknown newer version still means everything off.

### Notes
- Shared account health UI now lives in `client/accounts.tsx`; the agent panel, workspace panel and pill use the same rows, queries and clear-hold mutation.
- New pure logic (`upgradeRoutingValues`, `stuckConnections`, `poolVerdict`, `pillDecision`) is covered by `tests/routing-logic.mjs`.

## 0.12.0 — 2026-09-09

### Per-agent routing
- New **Routing** settings screen under Settings → Plugins → 9Router (also "Configure 9Router routing" in the Command Center): route Paseo agents through 9router without touching the machine-wide CLI config, reset account backoff automatically on rate limits, optionally retry the turn, and cap automatic retries per agent (0–5, default 1). Routing is off by default.
- `agent.session_open` hook: when routing is on and the session provider is `claude` or `ninerouter`, the plugin injects `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` and the `ANTHROPIC_DEFAULT_*_MODEL` slots into the session environment, picking models the same way CLI routing does. Codex sessions are never changed. Any failure leaves the request untouched and logs once.
- `agent.turn_ended` hook: a turn that fails on `429`, a rate limit, "no available account" or "all accounts parked" resets backoff on every active account of the agent's pool (Claude or Codex) with the same call as the Reset backoff button, then optionally asks the agent to "Retry the last request." under the per-agent cap.
- New **9Router** agent panel (workspace tabs and explorer, or "Show 9Router for this agent" in the Command Center): the agent's provider, model and status, whether it is routed, the accounts that can serve it with backoff level, model locks and last error, and a Reset backoff button per account.

### Notes
- The SDK has no server-side settings read in `@getpaseo/plugin` 0.8.0-beta.1, so the hooks read the daemon's persisted document at `$PASEO_HOME/plugin-settings/agent-link-9router/routing.json`. A missing file means defaults; an unreadable one means everything off.
- Pure routing decisions live in `shared/routing-logic.ts` and are covered by `tests/routing-logic.mjs`.

## 0.11.0 — 2026-09-09

Requires Paseo 0.8 or newer.

### Paseo 0.8
- Migrated to the Paseo 0.8 runtime layout: `index.client.tsx` and `index.server.ts` entries, code under `client/`, `server/`, and `shared/`, and `requirements.paseo` set to `>=0.8.0`. SDK dependency is `@getpaseo/plugin` `0.8.0-beta.1`.
- Removed the legacy `index.ts` entry and the local type shim. Repo tests re-pointed at the new file locations.

### Dashboard and tunnel
- "Open dashboard" now lives on the Overview tab's "Your next step" card, as well as Guide and Host setup.
- Opening the dashboard starts 9router's Cloudflare tunnel automatically when no SSH forward or running tunnel exists, waits for the public URL, and opens that instead of the router's loopback address. It refuses to publish while "API key required on /v1" is off.

### Accounts
- Accounts in backoff show a "Reset backoff" button on the Account health card. Clearing usage in the 9router dashboard does not reset backoff; this does.

### Since 0.9.0
- Guided setup, complete model catalog with readiness, Paseo picker sync, Astra and custom model registration.
- Daily usage series, spend limits, Tailscale and version checks, adaptive-thinking check, 9router patches tracked as power-ups.
- Timed SSH forward and remote dashboard access, sign-in outside Paseo, account selection strategy, quota by account, CLI routing, pxpipe and proxy-pool coverage.
- Never modifies Paseo's built-in providers; router update interruptions are explicit.

## 0.9.0 — 2026-09-02

Rewrite as a panel for a local 9router. See the GitHub release for details.
