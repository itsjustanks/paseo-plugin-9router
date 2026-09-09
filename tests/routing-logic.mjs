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
  const { parseRoutingEnvelope, routedSessionKind, isRateLimitError, poolForAgent, connectionsToReset, shouldRetry, ROUTING_DEFAULTS, ROUTING_DEFAULTS_OFF } = await import(join(staging, "routing.mjs"));

  assert.deepEqual(parseRoutingEnvelope(null), ROUTING_DEFAULTS, "missing file means schema defaults");
  assert.equal(parseRoutingEnvelope(null).routeAgents, false, "routing is off until a user turns it on");
  assert.deepEqual(parseRoutingEnvelope("not json"), ROUTING_DEFAULTS_OFF, "unreadable file means everything off");
  assert.deepEqual(parseRoutingEnvelope(JSON.stringify({ version: 2, values: { routeAgents: true } })), ROUTING_DEFAULTS_OFF, "a newer schema version never routes");
  const saved = parseRoutingEnvelope(JSON.stringify({ version: 1, values: { routeAgents: true, retryOnRateLimit: true, maxRetriesPerAgent: 3 } }));
  assert.deepEqual(saved, { routeAgents: true, autoResetBackoff: true, retryOnRateLimit: true, maxRetriesPerAgent: 3 });
  assert.equal(parseRoutingEnvelope(JSON.stringify({ version: 1, values: { maxRetriesPerAgent: 99 } })).maxRetriesPerAgent, 1, "out-of-range retries fall back to the default");

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
  console.log("✓ Routing settings parsing, provider gating, rate-limit matching, pool mapping, and retry caps passed");
} finally {
  rmSync(staging, { recursive: true, force: true });
}
