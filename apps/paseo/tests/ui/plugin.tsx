import React from "react";
import { View, Text } from "react-native";
import { useCallback } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
export function defineRpc<T>(contract: T) { return contract; }
const params = new URLSearchParams(location.search);
const empty = params.has("empty"), offline = params.has("offline"), failed = params.has("error");
// Panels and the pill first render before the host has any agent or workspace
// for them (useAgent/useWorkspace -> null, queries -> undefined), then re-render
// once data lands. `?late=<ms>` is how long the fixtures stay absent (default 300).
const LATE_MS = Number(params.get("late") ?? 300);
const ids = ["cc/claude-opus-5", "cc/claude-sonnet-4", "cx/gpt-6-astra", "cx/gpt-5.6-sol", ...Array.from({ length: 72 }, (_, i) => `demo/model-${String(i + 1).padStart(2, "0")}`)];
const connections = ["Studio account", "Development account"].map((name, i) => ({ id: `fictional-account-${i}`, provider: i ? "codex" : "claude", authType: "oauth", name, email: `demo${i + 1}@example.com`, priority: i + 1, isActive: true, testStatus: "active", expiresAt: null, usage: { plan: i ? "Pro" : "Max", limitReached: false, quotas: [{ label: "Session allowance", used: i ? 32 : 16, total: 100, remaining: i ? 68 : 84, remainingPercentage: i ? 68 : 84, resetAt: null, unlimited: false }], extra: null } }));
let selected: string[] = [];
const calls: string[] = [];
Object.assign(window, { __fixtureCalls: calls });
function defaults(schema: any): any {
  const d = schema._zod?.def ?? schema._def;
  if (d.type === "object") return Object.fromEntries(Object.entries(d.shape).map(([key, value]) => [key, defaults(value)]));
  if (d.type === "array") return [];
  if (d.type === "nullable") return null;
  if (d.type === "optional") return undefined;
  if (d.type === "default") return d.defaultValue;
  if (d.type === "enum") return Object.values(d.entries)[0];
  if (d.type === "literal") return d.values[0];
  if (d.type === "boolean") return false;
  if (d.type === "number") return 0;
  if (d.type === "string") return "";
  if (d.type === "record") return {};
  return null;
}
async function call(contract: any, input: any) {
  const name = contract.name.replace("agent-link-9router.router.", "");
  calls.push(name);
  if (failed && name === "status") throw new Error("Fictional router unavailable. Retry the connection.");
  const result = defaults(contract.output);
  if (name === "status") Object.assign(result, {
    clientVersion: { installed: "demo", advertised: "demo", mismatch: false }, binary: { path: "~/tools/9router", version: "demo" }, running: !offline,
    url: "http://localhost:20128", dashboardUrl: "http://localhost:20128/dashboard", settingsPath: "~/.agent-link/9router.json", version: null,
    auth: { configured: !offline, ok: !offline, error: null }, apiKey: { present: true, last4: "DEMO" },
    connections: empty || offline ? [] : connections, models: { count: empty || offline ? 0 : ids.length, ids: empty || offline ? [] : ids, custom: [{ providerAlias: "cx", id: "gpt-6-astra", name: "GPT-6 Astra", type: "llm" }] },
    aliases: [{ alias: "gpt-6-astra", model: "cx/gpt-6-astra" }], combos: [],
    hijack: ["Codex", "Claude"].map((label) => ({ cli: label.toLowerCase(), label, installed: true, routed: false, configPath: null, baseUrl: null, supported: true, note: "Direct provider access is configured.", defaultModels: [] })),
    uptime: { running: !offline, pid: 1000, uptimeSeconds: 86400, startedAt: null, rssMb: 240, lastSeenAt: null, previousRunSeconds: null, restartsToday: 0, history: [] }, warnings: [],
    paseo: { listedModels: { claude: ["cc/claude-opus-5"], codex: ["cx/gpt-6-astra"] }, modelsInSync: true, staleProviders: [], staleShims: [] },
  });
  if (name === "tuning") Object.assign(result, { cavemanLevel: "lite", ponytailLevel: "lite", comboStrategy: "fallback", stickyRoundRobinLimit: 3, requireApiKey: true });
  if (name === "health") Object.assign(result, { state: "ok", headline: "No issues reported", findings: [{ id: "demo-health", severity: "ok", title: "Accounts ready", detail: "Provider accounts report available allowance.", fix: null }] });
  if (name.includes("availability")) result.models = ids.map((id, i) => ({ id, label: id, readyAt: null, detail: "Fictional account availability", state: i % 13 === 0 ? "resting" : "ready", usable: i % 13 === 0 ? 0 : 1, accounts: 1 }));
  if (name === "sync-selection") result.selected = [...selected];
  if (name === "sync-selection.set") { selected = input.selected; Object.assign(result, { ok: true, message: "Demo shortlist saved." }); }
  if (name.includes("usage-stats")) Object.assign(result, { totalRequests: 1248, totalCost: 18.4, totalPromptTokens: 2400000, totalCachedTokens: 1800000, totalCompletionTokens: 360000 });
  if (name.includes("test")) Object.assign(result, { ok: true, message: "Fictional response received. No provider was contacted." });
  if (name.includes("logs") && "lines" in result) result.lines = ["[demo] Request routed successfully", "[demo] Provider allowance refreshed"];
  if (name === "model.add-astra") Object.assign(result, { ok: true, message: "Astra is already available in this fictional catalog." });
  // Account-health RPCs the panels and pill read; answered after LATE_MS so `data` is undefined on the first render.
  if (name === "connection-health") { await settle(); result.connections = offline ? [] : healthConnections; }
  if (name === "routing-health") { await settle(); Object.assign(result, routingHealth()); }
  if (name === "holds") { await settle(); Object.assign(result, { count: 1, holds: [{ connectionId: "fictional-account-0", provider: "claude", model: "cc/claude-opus-5", connectionName: "Studio account", status: "parked", until: null, lastError: "429 rate limited" }] }); }
  if (name === "spend") { await settle(); Object.assign(result, offline ? { ok: false, message: "9router did not answer." } : { ok: true, totals: { label: "last 1d", requests: 1248, promptTokens: 2400000, completionTokens: 360000, cachedTokens: 1800000, cost: 18.4, lastUsed: null } }); }
  if (name === "clear-hold") Object.assign(result, { ok: true, message: "Demo backoff reset." });
  // Transcript usage: fictional sessions across 40 days so the bars, calendar and table have shape.
  if (name === "transcript-usage") { await settle(); Object.assign(result, transcriptUsage()); }
  if (name === "agent-usage") { await settle(); Object.assign(result, agentUsage(input.agentId)); }
  return contract.output.parse(result);
}
export function useRpc(contract: any) { return useCallback((input: unknown) => call(contract, input), [contract]); }

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, LATE_MS));
const healthConnections = [
  { id: "fictional-account-0", provider: "claude", email: "demo1@example.com", name: "Studio account", isActive: true, backoffLevel: 0, modelLocks: [], lastError: "", lastErrorAt: null },
  { id: "fictional-account-1", provider: "claude", email: "demo2@example.com", name: "Spare account", isActive: true, backoffLevel: 2, modelLocks: ["cc/claude-sonnet-4"], lastError: "429 rate limited", lastErrorAt: null },
  { id: "fictional-account-2", provider: "claude", email: "demo3@example.com", name: "Stuck account", isActive: true, backoffLevel: 15, modelLocks: [], lastError: "429 rate limited", lastErrorAt: null },
  { id: "fictional-account-3", provider: "codex", email: "demo4@example.com", name: "Development account", isActive: true, backoffLevel: 0, modelLocks: [], lastError: "", lastErrorAt: null },
];
const routingHealth = () => ({
  checkedAt: new Date().toISOString(), routerReachable: !offline, routeAgents: true, showComposerPill: true, healthChecks: true,
  pools: [{ pool: "claude", ready: 1, resting: 2, stuck: 1 }, { pool: "codex", ready: 1, resting: 0, stuck: 0 }],
  stuck: offline ? [] : [{ id: "fictional-account-2", provider: "claude", label: "demo3@example.com", backoffLevel: 15, lastError: "429 rate limited", lastErrorAt: null }],
});

// --- Transcript usage fixtures. Deterministic pseudo-random so screenshots are stable; no real paths or titles.
const metrics = (input: number, cached: number, output: number, requests: number, cost: number | null, tools = 0, errors = 0) => ({
  inputTokens: input, uncachedTokens: input - cached, cacheReadTokens: cached, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: output, reasoningTokens: null,
  requests, userMessages: Math.max(1, Math.round(requests / 3)), assistantMessages: requests, toolCalls: tools, toolErrors: errors, toolExecutions: null, executionErrors: null,
  userCharacters: 400, assistantCharacters: 5000, toolInputCharacters: 900, toolOutputCharacters: 12000, compactions: 0, activeMs: requests * 9000, reportedCostUsd: null, estimatedCostUsd: cost,
});
const dayOf = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const noise = (seed: number) => ((seed * 9301 + 49297) % 233280) / 233280;
function transcriptUsage() {
  const sessions: any[] = [];
  const models = [["claude", "cc/claude-opus-5", 5, 25], ["claude", "claude-fable-5-1", 10, 50], ["codex", "gpt-6-astra", 10, 50], ["codex", "gpt-5.6-sol", 4, 20]] as const;
  for (let i = 0; i < 36; i++) {
    const [provider, model, inRate, outRate] = models[i % models.length];
    const daysAgo = Math.floor(noise(i) * 40);
    const scale = 0.3 + noise(i * 7) * 2.5;
    const input = Math.round(2_400_000 * scale), cached = Math.round(input * 0.93), output = Math.round(28_000 * scale), requests = Math.round(60 * scale);
    const cost = ((input - cached) * inRate + cached * inRate * 0.1 + output * outRate) / 1e6;
    const buckets: any[] = [{ day: dayOf(daysAgo), model, effort: null, metrics: metrics(input, cached, output, requests, i % 9 === 8 ? null : cost, Math.round(requests * 0.7), i % 5 === 0 ? 2 : 0), tools: { Bash: Math.round(requests * 0.4), Read: Math.round(requests * 0.3) } }];
    if (i % 4 === 1) buckets.push({ day: dayOf(daysAgo + 1), model, effort: null, metrics: metrics(Math.round(input / 3), Math.round(cached / 3), Math.round(output / 3), Math.round(requests / 3), cost / 3, 5, 0), tools: { Edit: 5 } });
    const inPaseo = i % 3 !== 2;
    sessions.push({ id: `${provider}:demo-${i}`, nativeId: `demo-session-${i}`, provider, kind: i % 11 === 10 ? "subagent" : "main", parentId: i % 11 === 10 ? `${provider}:demo-${i - 1}` : null,
      title: inPaseo ? ["Routed Claude agent", "Direct Claude agent", "Codex review agent", "Docs sweep", "Release 0.16.0 prep"][i % 5] : `${provider === "claude" ? "Claude" : "Codex"} ${String(i).padStart(12, "0")}`,
      agentId: inPaseo ? (i < 3 ? `agent-${i + 1}` : `demo-agent-${i}`) : null, agentProvider: inPaseo ? (provider === "claude" ? (i % 2 ? "ninerouter" : "claude") : "codex") : null,
      workspaceId: inPaseo ? (i % 2 ? "ws-1" : "ws-2") : null, workspace: inPaseo ? (i % 2 ? "paseo-plugin-9router" : "unfold-next") : "",
      projectId: inPaseo ? (i % 2 ? "p-1" : "p-2") : null, project: inPaseo ? (i % 2 ? "Paseo plugins" : "Unfold") : "Outside Paseo / unknown project",
      cwd: "", branch: "main", labels: [], archived: daysAgo > 20, status: daysAgo === 0 ? "running" : "idle", startedAt: `${dayOf(daysAgo)}T09:00:00.000Z`, endedAt: `${dayOf(daysAgo)}T${String(10 + (i % 9)).padStart(2, "0")}:30:00.000Z`,
      bytes: Math.round(input * 1.2), coverage: i % 9 === 8 ? "partial" : "available", warnings: i % 9 === 8 ? ["Skipped records larger than 16 MiB; statistics are partial."] : [], buckets });
  }
  return { sessions, scanning: false, completed: sessions.length, total: sessions.length, checkedAt: new Date().toISOString(), scanMs: 4200, scannedBytes: 1_900_000_000, warnings: [], missingSessions: 3 };
}
function agentUsage(agentId: string) {
  const m = metrics(9_400_000, 8_900_000, 96_000, 210, 12.4, 150, 3);
  const found = agentId === "agent-1" || agentId === "agent-2";
  const byDay = [4, 3, 2, 1, 0].map((ago, i) => ({ day: dayOf(ago), metrics: metrics(Math.round(m.inputTokens * (0.1 + i * 0.05)), Math.round(m.cacheReadTokens * (0.1 + i * 0.05)), Math.round(m.outputTokens * (0.1 + i * 0.05)), 30 + i * 10, 1.2 + i * 0.9) }));
  return { found, scanning: false, checkedAt: new Date().toISOString(), provider: found ? "claude" : null, coverage: found ? "available" : null, warnings: [], startedAt: `${dayOf(4)}T09:00:00.000Z`, endedAt: new Date().toISOString(), subagents: agentId === "agent-1" ? 2 : 0,
    metrics: found ? m : metrics(0, 0, 0, 0, null), byModel: found ? [{ model: "cc/claude-opus-5", metrics: metrics(7_000_000, 6_700_000, 70_000, 160, 9.1) }, { model: "cc/claude-sonnet-5", metrics: metrics(2_400_000, 2_200_000, 26_000, 50, 3.3) }] : [], byDay: found ? byDay : [] };
}

// --- Host client state: workspace, agents, and the Paseo API the workspace panel lists agents through.
const WORKSPACE = { id: "ws-1", name: "paseo-plugin-9router", projectDisplayName: "Paseo plugins", projectId: "p-1", projectRootPath: "/home/demo/projects", directory: "/home/demo/projects/paseo-plugin-9router", projectKind: "git", kind: "directory", title: null, status: "done", statusEnteredAt: null, archivingAt: null, diffStat: null };
const AGENTS = empty ? [] : [
  { id: "agent-1", workspaceId: "ws-1", provider: "ninerouter", model: "cc/claude-opus-5", status: "running", title: "Routed Claude agent", cwd: "/home/demo", createdAt: "", updatedAt: "", lastActivityAt: "", currentModeId: null, thinkingOptionId: null, requiresAttention: false, attentionReason: null },
  { id: "agent-2", workspaceId: "ws-1", provider: "claude", model: "cc/claude-sonnet-4", status: "idle", title: "Direct Claude agent", cwd: "/home/demo", createdAt: "", updatedAt: "", lastActivityAt: "", currentModeId: null, thinkingOptionId: null, requiresAttention: false, attentionReason: null },
  { id: "agent-3", workspaceId: "ws-1", provider: "codex", model: "gpt-5.6-sol", status: "error", title: null, cwd: "/home/demo", createdAt: "", updatedAt: "", lastActivityAt: "", currentModeId: null, thinkingOptionId: null, requiresAttention: false, attentionReason: null },
];
let hostDataReady = false;
const hostListeners = new Set<() => void>();
const hostStore = {
  subscribe(listener: () => void) { hostListeners.add(listener); return () => { hostListeners.delete(listener); }; },
  getWorkspace: (id: string) => (hostDataReady && id === WORKSPACE.id ? WORKSPACE : null),
  getAgent: (id: string) => (hostDataReady ? AGENTS.find((agent) => agent.id === id) ?? null : null),
};
setTimeout(() => { hostDataReady = true; for (const listener of hostListeners) listener(); }, LATE_MS);
function shallowEqual(left: any, right: any) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = Object.entries(left), b = Object.entries(right);
  return a.length === b.length && a.every(([key, value]) => Object.is(value, right[key]));
}
// Same shape as the SDK: a selector over an external store, null until the entity exists.
function useEntity<T, S>(read: () => T | null, selector: (entity: T) => S): S | null {
  return useSyncExternalStoreWithSelector(hostStore.subscribe, read, read, (entity: T | null) => (entity ? selector(entity) : null), shallowEqual);
}
export function useWorkspace<S>(workspaceId: string, selector: (workspace: any) => S): S | null { return useEntity(() => hostStore.getWorkspace(workspaceId), selector); }
export function useAgent<S>(agentId: string, selector: (agent: any) => S): S | null { return useEntity(() => hostStore.getAgent(agentId), selector); }
const paseo = {
  agents: {
    subscribe(listener: (update: any) => void) {
      const timer = setTimeout(() => { for (const agent of AGENTS) listener({ kind: "upsert", agent }); }, LATE_MS);
      return () => clearTimeout(timer);
    },
    async list() { await settle(); return { entries: AGENTS.map((agent) => ({ agent, project: null })) }; },
  },
};
export function usePaseo() { return paseo; }
export function Icon({ name, size = 14, color }: { name: string; size?: number; color?: string }) { return <Text accessibilityLabel={`icon ${name}`} style={{ color, fontSize: size }}>◆</Text>; }

export const Modal = Object.assign(({ children, open, title }: any) => open ? <View role="dialog" aria-label={title} style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" }}><View style={{ maxWidth: 520, padding: 20, backgroundColor: "#1a2029" }}><Text style={{ color: "#eef1f6", fontSize: 18 }}>{title}</Text>{children}</View></View> : null, { Content: ({ children }: any) => <View>{children}</View> });
