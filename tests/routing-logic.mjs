import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "../apps/paseo/node_modules/typescript/lib/typescript.js";

// Pure decisions behind the session_open and turn_ended hooks; no daemon, router, or SDK.
const staging = mkdtempSync(join(tmpdir(), "router-routing-"));
try {
  const source = readFileSync(new URL("../apps/paseo/shared/routing-logic.ts", import.meta.url), "utf8");
  writeFileSync(join(staging, "routing.mjs"), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { parseRoutingEnvelope, upgradeRoutingValues, routedSessionKind, isRateLimitError, poolForAgent, connectionsToReset, shouldRetry, stuckConnections, poolVerdict, pillDecision, ROUTING_DEFAULTS, ROUTING_DEFAULTS_OFF, ROUTING_SETTINGS_VERSION, STUCK_BACKOFF_LEVEL } = await import(join(staging, "routing.mjs"));

  assert.deepEqual(parseRoutingEnvelope(null), ROUTING_DEFAULTS, "missing file means schema defaults");
  assert.equal(parseRoutingEnvelope(null).routeAgents, false, "routing is off until a user turns it on");
  assert.deepEqual(parseRoutingEnvelope("not json"), ROUTING_DEFAULTS_OFF, "unreadable file means everything off");
  assert.equal(ROUTING_SETTINGS_VERSION, 2);
  assert.deepEqual(parseRoutingEnvelope(JSON.stringify({ version: 3, values: { routeAgents: true } })), ROUTING_DEFAULTS_OFF, "a newer schema version never routes");
  assert.deepEqual(parseRoutingEnvelope(JSON.stringify({ version: "1", values: { routeAgents: true } })), ROUTING_DEFAULTS_OFF, "a non-numeric version never routes");
  // The document 0.12.0 wrote: v1 with the user's routing on. Upgrading must keep routing on.
  const saved = parseRoutingEnvelope(JSON.stringify({ version: 1, values: { routeAgents: true, retryOnRateLimit: true, maxRetriesPerAgent: 3 } }));
  assert.deepEqual(saved, { routeAgents: true, autoResetBackoff: true, retryOnRateLimit: true, maxRetriesPerAgent: 3, healthChecks: true, healthIntervalMinutes: 10, showComposerPill: true }, "a v1 document keeps routing on and gains health defaults");
  assert.deepEqual(upgradeRoutingValues({ routeAgents: true }), { ...ROUTING_DEFAULTS, routeAgents: true }, "migrate fills every missing field from defaults");
  assert.deepEqual(upgradeRoutingValues(null), ROUTING_DEFAULTS, "migrate tolerates a missing values object");
  const v2 = parseRoutingEnvelope(JSON.stringify({ version: 2, values: { routeAgents: true, healthChecks: false, healthIntervalMinutes: 30, showComposerPill: false } }));
  assert.deepEqual(v2, { ...ROUTING_DEFAULTS, routeAgents: true, healthChecks: false, healthIntervalMinutes: 30, showComposerPill: false });
  assert.equal(parseRoutingEnvelope(JSON.stringify({ version: 1, values: { maxRetriesPerAgent: 99 } })).maxRetriesPerAgent, 1, "out-of-range retries fall back to the default");
  assert.equal(parseRoutingEnvelope(JSON.stringify({ version: 2, values: { healthIntervalMinutes: 1 } })).healthIntervalMinutes, 10, "too-short intervals fall back to the default");
  assert.equal(parseRoutingEnvelope(JSON.stringify({ version: 2, values: { healthIntervalMinutes: 999 } })).healthIntervalMinutes, 10, "too-long intervals fall back to the default");
  assert.equal(ROUTING_DEFAULTS_OFF.healthChecks, false, "an unreadable document never starts the poller");

  assert.equal(routedSessionKind("claude", "ninerouter"), "claude");
  assert.equal(routedSessionKind("ninerouter", "ninerouter"), "ninerouter");
  assert.equal(routedSessionKind("codex", "ninerouter"), null, "codex is never injected");

  for (const text of ["HTTP 429 Too Many Requests", "Rate limit exceeded", "rate-limited by upstream", "No available account for cc/claude-opus-5", "All 3 accounts parked", "all accounts unavailable"]) {
    assert.equal(isRateLimitError(text), true, text);
  }
  assert.equal(isRateLimitError("ECONNREFUSED 127.0.0.1:20128"), false);
  assert.equal(isRateLimitError(null), false);

  assert.equal(poolForAgent("ninerouter", "cc/claude-opus-5", "ninerouter"), "claude");
  assert.equal(poolForAgent("ninerouter", "cx/gpt-5.6-sol", "ninerouter"), "codex");
  assert.equal(poolForAgent("ninerouter", "gpt-6-astra", "ninerouter"), "codex", "codex ids need no prefix");
  assert.equal(poolForAgent("claude", null, "ninerouter"), "claude");
  assert.equal(poolForAgent("ninerouter", null, "ninerouter"), null, "no model means no pool to reset");
  assert.equal(poolForAgent("gemini", "x", "ninerouter"), null);

  const connections = [
    { id: "a", provider: "claude", isActive: true, backoffLevel: 2 },
    { id: "b", provider: "claude", isActive: true, backoffLevel: 0 },
    { id: "c", provider: "claude", isActive: false, backoffLevel: 3 },
    { id: "d", provider: "codex", isActive: true, backoffLevel: 1 },
  ];
  assert.deepEqual(connectionsToReset(connections, "claude").map((entry) => entry.id), ["a"], "only active resting accounts of the pool");
  assert.deepEqual(connectionsToReset(connections, "codex").map((entry) => entry.id), ["d"]);

  assert.equal(shouldRetry(saved, 0), true);
  assert.equal(shouldRetry(saved, 3), false, "the cap is per agent");
  assert.equal(shouldRetry({ ...saved, retryOnRateLimit: false }, 0), false);
  assert.equal(shouldRetry({ ...saved, autoResetBackoff: false }, 0), false, "retry requires reset");
  assert.equal(shouldRetry(ROUTING_DEFAULTS, 0), false, "defaults never retry");

  // The case that bit: an active account at backoff 15 with a 429 looked fine while one account carried the pool.
  const pool = [
    { id: "ankit", provider: "claude", isActive: true, backoffLevel: 15 },
    { id: "second", provider: "claude", isActive: true, backoffLevel: 0 },
    { id: "third", provider: "claude", isActive: true, backoffLevel: 2 },
    { id: "parked", provider: "claude", isActive: false, backoffLevel: 20 },
    { id: "cx", provider: "codex", isActive: true, backoffLevel: 7 },
  ];
  assert.equal(STUCK_BACKOFF_LEVEL, 5);
  assert.deepEqual(stuckConnections(pool).map((entry) => entry.id), ["ankit", "cx"], "stuck = active and at or past the threshold; parked accounts are not stuck");
  assert.deepEqual(stuckConnections(pool, 2).map((entry) => entry.id), ["ankit", "third", "cx"]);
  assert.deepEqual(poolVerdict(pool, "claude"), { pool: "claude", ready: 1, resting: 2, stuck: 1 });
  assert.deepEqual(poolVerdict(pool, "codex"), { pool: "codex", ready: 0, resting: 1, stuck: 1 });
  assert.deepEqual(poolVerdict([], "claude"), { pool: "claude", ready: 0, resting: 0, stuck: 0 });

  const on = { routeAgents: true, showComposerPill: true };
  const healthy = { pool: "claude", ready: 2, resting: 0, stuck: 0 };
  const base = { settings: on, routerReachable: true, routed: true, pool: "claude" };
  assert.equal(pillDecision({ ...base, verdict: healthy }).show, false, "a healthy routed agent gets no pill");
  assert.equal(pillDecision({ ...base, verdict: healthy, settings: { routeAgents: false, showComposerPill: true }, routed: false }).show, false, "routing off and healthy: nothing to say");
  assert.deepEqual(pillDecision({ ...base, verdict: poolVerdict(pool, "claude") }), { show: true, label: "1 account stuck", tone: "danger" });
  assert.deepEqual(pillDecision({ ...base, verdict: { pool: "claude", ready: 1, resting: 1, stuck: 0 } }), { show: true, label: "1 resting · 1 ready", tone: "warning" });
  assert.deepEqual(pillDecision({ ...base, verdict: { pool: "claude", ready: 0, resting: 2, stuck: 0 } }), { show: true, label: "2 resting · 0 ready", tone: "danger" }, "nothing ready is danger");
  assert.deepEqual(pillDecision({ ...base, verdict: { pool: "claude", ready: 0, resting: 0, stuck: 0 } }), { show: true, label: "No accounts", tone: "danger" });
  assert.deepEqual(pillDecision({ ...base, verdict: healthy, routed: false }), { show: true, label: "Not routed", tone: "warning" }, "routing on but this agent bypasses the pool");
  assert.deepEqual(pillDecision({ ...base, verdict: null, routerReachable: false }), { show: true, label: "9Router offline", tone: "danger" });
  assert.equal(pillDecision({ ...base, verdict: null, routerReachable: false, routed: false, settings: { routeAgents: false, showComposerPill: true } }).show, false, "offline router with routing off is not this agent's problem");
  assert.equal(pillDecision({ ...base, verdict: null }).show, false, "an empty cache says nothing");
  assert.equal(pillDecision({ ...base, verdict: poolVerdict(pool, "claude"), settings: { routeAgents: true, showComposerPill: false } }).show, false, "the setting hides the pill");
  assert.equal(pillDecision({ ...base, verdict: poolVerdict(pool, "claude"), pool: null }).show, false, "providers 9router does not serve get no pill");
  console.log("✓ Routing settings parsing and v1→v2 upgrade, provider gating, rate-limit matching, pool mapping, retry caps, stuck backoff, and pill decisions passed");
} finally {
  rmSync(staging, { recursive: true, force: true });
}
