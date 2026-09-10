# Changelog

## 0.14.2 — 2026-09-10

### The surface crashed on first paint: "Plugin failed: Minified React error #310"
- Opening the 9Router surface in Paseo threw React error #310 ("Rendered more hooks than during the previous render"). In `client/surface.tsx`, `AgentLinkSurface` called `useMutation` for the dashboard button *after* its `if (status.isLoading && !data) return …` loading branch, so the first render ran one hook fewer than every render after router status arrived. The hook now runs before that return. This shipped in **0.11.0** (`042a177`) and affected 0.11.0 through 0.14.0 — none of those is a safe rollback. The moved hook landed in 0.14.1 alongside the dashboard-link work; this release records why and adds the tests that were missing.
- Diagnosed with React's development build, which names the component and the hook: `React has detected a change in the order of Hooks called by AgentLinkSurface … 468. undefined → useContext`, then `Rendered more hooks than during the previous render.`

### Notes
- The preview harness only ever mounted `AgentLinkSurface`, and with an instant fixture it never saw the loading render, so the surface, `RouterWorkspacePanel`, `RouterAgentPanel` and `RoutingPill` all reached users untested. `tests/ui/preview.tsx` now mounts any of them (`?workspace`, `?agent[=id]`, `?pill`) and `tests/ui/plugin.tsx` stubs `useAgent`, `useWorkspace`, `usePaseo` and `useRpc` so each renders once with no data and again when it arrives (`?late=<ms>`), the sequence the live host produces.
- New `tests/hook-order.mjs` (in `npm test`) mounts every contributed component through that absent → present transition under React's development build with `react-test-renderer` and fails on any hook-order complaint; it fails on the 0.14.0 surface and passes now. Panels and the pill were checked the same way: no other component had this class of bug.

## 0.14.1 — 2026-09-10

### "Open dashboard" no longer lands on a blank page
- The 9router dashboard signs you in with a session cookie, and Paseo's built-in browser tab has no cookie jar for it to use — so `Linking.openURL` produced a blank page or a login loop, even with the Cloudflare tunnel up and serving. Every dashboard button now does what the OAuth sign-in link already did: copies the link and tells you to paste it into your normal browser. Buttons read **Copy dashboard link**; the old **Copy URL** is now **Copy loopback URL** and says where it works. This build of the plugin SDK exposes no way to open an external browser, so the clipboard is the honest answer.
- Links land on `/login`, not `/dashboard`: a browser with no 9router session gets a 307 to `/login` from `/dashboard` (and two hops from `/`), which embedded views handle worst. Measured against a live router through loopback and both tunnel hosts.
- Tunnel address choice: 9router reports a raw `trycloudflare.com` host and a branded `publicUrl` in front of it. The raw host is now preferred everywhere (`tunnelAddress` in `shared/router-logic.ts`); cold it answered in ~40ms where the branded host took ~400ms and relies on a second service staying up. The branded host remains the fallback.
- `routerDashboardOpen` always says which address it chose (SSH forward, the tunnel 9router already had open, or loopback) instead of returning an empty message when the tunnel was already running — which is what read as "the button does nothing".
- A missing dashboard password is named as such. The management API refuses the bearer key, so without a saved password every tunnel check failed with a tunnel-shaped message; the handler now stops early and points at **Guide & Setup → Dashboard password**.

### Notes
- New pure helpers `tunnelAddress` and `dashboardEntryUrl` in `shared/router-logic.ts`, covered in `tests/router-logic.mjs`. The `requireApiKey` gate on publishing a tunnel is unchanged.

## 0.14.0 — 2026-09-10

### Workspace panel is about the workspace
- The **9Router** workspace panel now leads with this workspace's agents: each one's title, provider and model, a **Via 9Router** / **Direct provider** / **Direct · never routed** (Codex) verdict, and the pool it draws from. Rows open the agent where the host supports navigation. The header counts routed versus direct agents and names the pools in use; a stuck account in one of those pools is called out at the top.
- Everything one router shares across workspaces is kept but demoted and marked **whole host**: last-day usage (requests, tokens in/out, API-equivalent cost via the existing `routerSpend` RPC), stuck accounts, and both pools' account lists with Reset backoff per account and reset-all. Pools this workspace uses come first; pools it does not use say so.
- Usage is shown host-wide on purpose. 9router's `usageHistory` rows carry `provider`, `model`, `connectionId` and `apiKey` only (and `requestDetails` strips inbound headers); every Paseo session shares one API key, so no request can be attributed to a workspace. The panel states this instead of inventing a per-workspace number.

### Notes
- New pure logic `agentRouting` and `workspaceRoutingSummary` in `shared/routing-logic.ts`, covered by `tests/routing-logic.mjs`. The agent panel now uses the same verdict as the workspace panel through `RoutingChip` / `routingFor` in `client/accounts.tsx`.
- The workspace panel lists agents through `usePaseo().agents.list({ scope: "active" })` and keeps them current from the same `agents.subscribe` stream the composer pill uses.
- A `claude` agent reads as direct even when per-agent routing injected 9router's environment into its session; that injection is server-side and the client cannot see it. The panel's note says so when routing is on.

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
