# 9Router for Paseo

**Your accounts, model catalog, and routing controls in one guided Paseo interface.**

Use the separate **9Router** provider for routed sessions. Keep direct Claude and Codex access
as another choice. Inspect quotas, find any model, add Astra, and understand a setting before
changing it.

![Overview with fictional router status and next steps.](docs/screenshots/setup.png)

*Screenshots use actual UI components with fictional data. No live accounts, credentials,
server addresses, or conversation history are used.*

## Install

Install and run [9router](https://github.com/decolua/9router) on your Paseo host, then add the plugin:

```sh
npm install -g 9router
9router
paseo plugin add itsjustanks/paseo-plugin-9router --path apps/paseo --id agent-link-9router
```

Enable plugins in Paseo Settings if necessary. Confirm the plugin is `running`, then open
**9Router** from the sidebar. The plugin is trusted code running with the daemon's privileges.
9router remains a separate dependency; installing this panel does not install the router.

Update a Git-managed installation with:

```sh
paseo plugin update agent-link-9router
```

No Paseo daemon restart is required. Reloading this plugin does not restart 9router.

## Your first routed model

1. Select the intended Paseo host. Open **Guide & Setup → Host setup** and save the router's
   dashboard URL and password. The router password is separate from your Paseo password.
2. Open **Accounts → Accounts & quotas** and connect Claude or Codex. Complete sign-in in your
   normal browser. Other providers can be connected through 9router's dashboard — **Copy dashboard
   link** copies its address (SSH forward, running tunnel, or loopback) for your normal browser; the
   dashboard signs in with a cookie that Paseo's built-in browser tab cannot hold.
3. Open **Models → Model catalog**. Search every model, optionally choose a shortlist, then open
   **Paseo picker → Sync into Paseo**.
4. Create a new Paseo session and choose the **9Router** provider and the desired model.

**Machine-wide CLI routing is optional.** You do not need to rewrite direct Codex or Claude
configuration to use the separate 9Router provider. The setup checklist ends with picker sync.

## Find the right control

| Section | Features |
| --- | --- |
| **Overview** | Router connection, account/model counts, **Can the pool serve right now?** with a Check now ping, next-step guidance, direct/routed CLI state, health findings |
| **Accounts** | Sign-in, quota windows, spend caps, account search, health, holds, rotation and priority |
| **Models** | Complete catalog, search/sort/pages, explicit request tests, shortlist, picker sync, Astra, aliases |
| **Routing & Access** | CLI diagnostics, proxy state, pxpipe, API keys, fallback combos, token-saving settings |
| **Usage & Health** | Daily trends, tokens, API-equivalent costs, account usage, failed requests and console logs |
| **Setup** | Walkthrough, feature directory, connection setup, remote dashboard, Tailscale, maintenance |

Each section is one page. Before 0.16.0 these six sections held fourteen tabs, so finding a
control meant remembering which half of a section it lived in; tabs that answered the same
question were merged. Nothing was removed, and older links still resolve — a bookmark or Command
Center item naming a merged tab opens the page that absorbed it.

### Can the pool serve right now?

Overview answers this directly. **Check now** asks the router which models an account can actually
serve and lists every blocked one as rate-limited, resting or unserved, with its usable-account
count and the router's own reason. When nothing can serve — every account rate-limited or backed
off — it says so and offers Reset backoff, because that is the state where new routed sessions
fail. Readiness reflects reported account state; Test in the catalog sends a real request.

### Accounts without the long mixed list

![Fictional accounts grouped by provider with quota bars.](docs/screenshots/accounts.png)

Accounts has three focused views: **Accounts & quotas**, **Health & holds**, and
**Rotation & priority**. Allowance and spending limits are separate signals. An account may have
quota remaining but still be blocked by a spend cap, an expired token, or router backoff.

Use the account search to find a name or provider. Removing an account requires confirmation;
parking it keeps its credentials while excluding it from rotation.

### Every model is reachable

![Catalog search for fictional Codex availability, including Astra.](docs/screenshots/models.png)

Search by model ID, provider prefix, or readiness. Click **Model**, **Provider**, or **Readiness**
to sort; click again to reverse the order. The catalog shows 12 models per page and includes
models beyond the old first-60 shortlist and eight-per-provider test limits.

**Shortlist** starts a smaller selection. An empty shortlist means all models. Saving a shortlist
and syncing it into Paseo are separate steps, both explained in the interface.

Readiness comes from reported account state; it is not a successful completion. **Test** sends
a small real request and consumes provider quota. Browsing does not send a completion.

### Add GPT-6 Astra

Open **Models → Astra & custom models → Add GPT-6 Astra**. This registers `cx/gpt-6-astra`, adds the
`gpt-6-astra` alias, and adds Astra to the separate 9Router picker. It preserves a conflicting alias
and explains what needs attention, supports retries, and retains Astra in an explicit shortlist.

This action does not rewrite direct Codex settings or refresh direct providers. Registration does
not guarantee that your connected account can use Astra; **Test Astra (uses quota)** checks access.
You can register other new models by supplying the provider prefix and model ID in the same view.

### Token settings and advanced features

![Token settings in the fictional preview.](docs/screenshots/tuning.png)

The existing controls remain available: RTK, Caveman, Ponytail, Headroom, sticky limits, fallback
combos, proxy diagnostics, API keys, account strategies, version checks, daily usage, Tailscale,
and optional maintenance fixes. The in-app feature directory points to the relevant section.
Use the installed 9router dashboard for additional providers, media, translation, skills, and
advanced features not exposed natively. Their availability depends on the installed router version.

## What changes when you press a button

| Action | Effect |
| --- | --- |
| Open a section / refresh status | Reads status and supporting diagnostics; no completion request |
| Test a model / adaptive thinking check | Sends a real provider request and uses quota |
| Change shortlist | Saves the desired model selection; picker sync is a separate action |
| Sync into Paseo | Updates the `ninerouter` provider and removes recognized legacy plugin entries |
| Add Astra | Adds its routed catalog entry, alias, shortlist entry when needed, and picker entry |
| Route / restore a CLI | Rewrites that CLI's machine-wide configuration after confirmation |
| Stop / restart router | Interrupts routed traffic after confirmation |
| Apply maintenance / update | Performs the specific described change; read its effect first |

Sync does not rewrite direct CLI configuration. A legacy repair can clear an older plugin-generated
`additionalModels` list on built-in providers when every entry belongs to the router catalog.
A user-curated list is left alone. Existing sessions retain their provider selection.

Account credentials stay in 9router. The plugin stores its dashboard connection in `~/.agent-link`.
API key lists show only the last four characters; explicitly copying a key puts its full value
on your clipboard. Treat copied keys and real diagnostic logs as private.

## Per-agent routing

Machine-wide CLI routing (Host setup) rewrites `~/.claude/settings.json`, so every Claude Code
process on the host goes through 9router. Per-agent routing does the same thing for the sessions
Paseo opens, and nothing else.

Open **Settings → Plugins → 9Router → Routing** (or run "Configure 9Router routing" from the
Command Center) and turn on **Route Paseo agents through 9router**. From then on, every Claude
session Paseo starts or resumes gets 9router's URL, API key and default model slots in its
environment. Codex sessions are never touched; they read their own config. Terminal Claude Code
keeps its direct connection unless you also route the CLI.

The same screen controls what happens when a turn fails on a rate limit or "no available
account": **Reset backoff automatically** clears backoff on every account that can serve that
model (on by default), **Retry the turn after a reset** sends "Retry the last request." to the
agent, and **Automatic retries per agent** caps how often that can happen.

### Agent panel

Each agent has a **9Router** tab (workspace tabs and the explorer once an agent is open, or "Show
9Router for this agent" in the Command Center) showing its provider and model, whether it runs
**via 9Router** or talks to its provider **directly**, the pool it draws from, and that pool's
accounts with their backoff level, a Reset backoff button per account and a reset-all button. A
Codex agent is always direct; Codex sessions are never routed.

There is no workspace-level panel. Accounts, quotas and backoff belong to the host — one router
serves every workspace — so a workspace-labelled view of them was misleading (0.13.0 to 0.14.2
shipped one). The host-wide facts live on the main **9Router** surface instead: stuck accounts
and Reset backoff under **Accounts → Health & holds**, last-day usage under **Usage & Health**.

**Router** usage cannot be split per workspace. 9router records provider, model, account and API
key for each request (`usageHistory` columns `provider`, `model`, `connectionId`, `apiKey`), and
every Paseo session shares one key, so nothing ties a request to a workspace. Those figures are
always labelled as covering the whole host rather than dressed up as a workspace number.

Since 0.16.0 the **Usage** section answers that question from the other end — see below.

## Usage

**Usage** on the main surface reads the Claude Code and Codex transcripts on the selected daemon,
including archived sessions, subagents, and sessions started outside Paseo, then joins them to
Paseo's project, workspace and agent records. That is where per-session, per-workspace and
per-agent attribution comes from: the router cannot tell you which workspace spent what, but the
transcripts can, and they also cover traffic that never went through 9router at all — terminal
Claude Code and Codex sessions included.

- **Compare providers** puts Claude and Codex on one zero-based scale, by day, week, month,
  project or model.
- **Daily activity** is a GitHub-style calendar; selecting a day filters everything below it.
- A grouped table totals by session, project, workspace, model or day, with tokens, cache hit
  rate, requests, tool calls, estimated cost and active time.
- Each agent's **9Router** tab carries its own usage card: that agent's tokens and estimated cost.

**Two sources, never blended.** Figures from 9router are what it billed for traffic it actually
routed. Figures from transcripts cover everything but are an **estimate at base API prices**,
excluding priority processing, long-context premiums and any plan charges — every transcript
number is labelled "transcript estimate" wherever it appears. Where a transcript did not record a
measurement the cell reads "—" rather than zero, and totals show how many sessions are priced.

The first scan of a large history takes a few minutes; the section shows its file count while it
works and keeps the previous completed scan visible. After that it is incremental, re-reading only
files whose size or modification time changed. Message text, tool results and credentials never
leave the parser.

### Automatic health checks

Account health used to be read only while a 9Router page was open or when a turn failed. Since
0.13.0 the plugin checks it in the background: every 10 minutes by default it asks 9router for
each account's backoff, caches the answer, and logs once when an active account is **stuck**,
meaning 9router has backed it off past level 5 and stopped retrying it while still counting it
as a serving slot. That is the state that leaves one account quietly carrying the whole pool
while the others look active. Pills read the cache, so many agents cost one request; stuck
accounts are named under **Accounts → Health & holds**, where Reset backoff puts them back to work.

The **Account health** section of the Routing settings screen controls this: **Check account
health in the background** (on by default), **Check interval** (2 minutes to 2 hours, default
10 minutes), and **Show a 9Router pill in agent composers** (on by default).

### Composer pill

When there is something to act on, a **9Router** pill appears above an agent's message box:
accounts resting or stuck in that agent's pool, no accounts ready, the router offline while
routing is on, or an agent talking to its provider directly while routing is on ("Not routed").
Healthy agents get no pill, so the composer stays quiet when everything works. Pressing it opens
the 9Router accounts page, where backoff is reset and accounts are added.

## Using another host

The selected Paseo host owns this plugin's requests and settings. Its `localhost` belongs to that
machine. Opening a remote router's localhost URL in your laptop browser does not reach the server.

Review **Guide & Setup → Host setup → Remote dashboard** for forwarding options, or use your
existing private network route. This plugin's SSH helper runs on the selected host and needs
working keys; it cannot type an SSH password for you. Tailscale and temporary router tunnels
are optional controls, not prerequisites for native account/model views.

## Troubleshooting

| Symptom | Start here |
| --- | --- |
| Router unavailable | Check the selected host, running 9router process, and Host setup connection |
| Empty account list | Save the router dashboard password, then refresh |
| Dashboard opens blank in Paseo | Expected: the dashboard needs a cookie that Paseo's browser tab cannot hold. **Copy dashboard link** puts the address on your clipboard — paste it into your normal browser and sign in there |
| Model absent from Paseo | Refresh catalog, add a custom model if necessary, then sync the picker |
| Model listed but failing | Account health, quota/spend caps, holds, and Requests & logs |
| Direct Codex is shown | This is a valid configuration; choose 9Router for a routed session |
| Version-gated Claude request fails | Review Maintenance and the reported installed/advertised client versions |
| New UI does not appear | Update/reload `agent-link-9router` and reopen its sidebar entry |
| One account serves everything | Open **Accounts → Health & holds** (or the agent's 9Router tab); accounts marked **stuck** need Reset backoff |
| Plugin missing under Projects | Expected since 0.15.0: the plugin contributes an agent panel, not a workspace panel. Open an agent to see its 9Router tab |
| Agent shows "Direct provider" while routing is on | Expected for `claude` agents: the env injection is not visible to the client. Pick the **9Router** provider for a verdict of "Via 9Router" |

The router's **Update and restart…** action replaces its installed package and restarts the server.
Wait for routed work to finish and review compiled-file customizations first. Plugin updates
reload the Paseo panel separately; they do not upgrade or restart the router.

## Development

```sh
git clone https://github.com/itsjustanks/paseo-plugin-9router.git
cd paseo-plugin-9router/apps/paseo
npm ci
npm run typecheck
npm test
npm run preview:ui
# Open http://127.0.0.1:43198
```

The preview uses fictional RPC fixtures and never connects to a daemon or provider. `?light`,
`?empty`, `?offline`, and `?error` exercise theme and recovery states; `?agent[=id]` and `?pill`
mount the agent panel and composer pill instead of the surface, each rendered once with no data
and again when it arrives (`?late=<ms>`). `npm test` includes
`tests/hook-order.mjs`, which mounts every contributed component through that transition under
React's development build and fails on any hook-order complaint. See the
[screenshot guide](docs/screenshots/README.md) before updating public images.

Requires Paseo 0.8 or newer. Since 0.11.0 the plugin uses the 0.8 runtime layout:
`index.client.tsx` and `index.server.ts` entries with code under `client/`, `server/`, and
`shared/`, and `requirements.paseo` set to `>=0.8.0`. Paseo 0.7 hosts should stay on 0.9.0.
Tests cover pure routing/usage logic, the routing settings (including the v1 to v2 upgrade,
stuck-backoff detection, per-agent routing verdicts and pill decisions),
Astra registration and provider isolation, and complete catalog pagination on Node 20+.

The SDK has no server-side settings read in `@getpaseo/plugin` 0.8.0-beta.1, so the hooks and
the health poller read the daemon's persisted document at
`$PASEO_HOME/plugin-settings/agent-link-9router/routing.json`. A missing file means defaults; a
document from an older known schema version is upgraded in place; an unreadable or newer one
means everything off.

The optional `agent-link` shell CLI is included at the repository root. It retains its existing
terminal workflows; this release focuses on the Paseo plugin.

## Credits

The **Usage** section and the per-agent usage card are built on transcript-reading code adapted
from [session-usage](https://github.com/panrafal/paseo-plugins/tree/8d33de5ff811096511c856795dfe0a7a41481338/session-usage)
by **panrafal**, used under the MIT License. The transcript parser, the indexer, the usage and
calendar models, the base-API pricing table, and the provider-comparison and activity-calendar
visualisations all derive from that project at commit `8d33de5`. Every adapted file carries a
header naming its source, and the full licence text is reproduced in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

If you want the complete usage report — every grouping dimension, the full filter bar, CSV export
— install session-usage itself. This plugin takes only what serves routing: where the tokens went,
per session, workspace and agent, next to what 9router actually billed.

## License

[MIT](LICENSE)
