# Changelog

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
