# Changelog

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
