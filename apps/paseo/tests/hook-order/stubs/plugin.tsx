/**
 * Node stand-in for @getpaseo/plugin and its client entries. The host store is
 * switchable so a test can render every component with no agent, workspace or
 * RPC answer, then flip to data and re-render — the transition that surfaces a
 * hook called after an early return.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

export function defineRpc<T>(contract: T) { return contract; }
export function defineSettings<T>(definition: T) { return definition; }

let ready = false;
const listeners = new Set<() => void>();
/** Flip the fixtures from absent to present and notify every mounted hook. */
export function setHostDataReady(value: boolean) {
  ready = value;
  for (const listener of listeners) listener();
}

export const WORKSPACE = { id: "ws-1", name: "paseo-plugin-9router", projectDisplayName: "Paseo plugins" };
export const AGENTS = [
  { id: "agent-1", workspaceId: "ws-1", provider: "ninerouter", model: "cc/claude-opus-5", status: "running", title: "Routed Claude agent" },
  { id: "agent-2", workspaceId: "ws-1", provider: "claude", model: "cc/claude-sonnet-4", status: "idle", title: "Direct Claude agent" },
  { id: "agent-3", workspaceId: "ws-1", provider: "codex", model: "gpt-5.6-sol", status: "error", title: null },
];

function shallowEqual(left: any, right: any) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = Object.entries(left), b = Object.entries(right);
  return a.length === b.length && a.every(([key, value]) => Object.is(value, right[key]));
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function useEntity<T, S>(read: () => T | null, selector: (entity: T) => S): S | null {
  return useSyncExternalStoreWithSelector(subscribe, read, read, (entity: T | null) => (entity ? selector(entity) : null), shallowEqual);
}
export function useWorkspace<S>(workspaceId: string, selector: (workspace: any) => S) {
  return useEntity(() => (ready && workspaceId === WORKSPACE.id ? WORKSPACE : null), selector);
}
export function useAgent<S>(agentId: string, selector: (agent: any) => S) {
  return useEntity(() => (ready ? AGENTS.find((agent) => agent.id === agentId) ?? null : null), selector);
}

const paseo = {
  agents: {
    subscribe(_listener: (update: any) => void) { return () => {}; },
    async list() { return { entries: AGENTS.map((agent) => ({ agent, project: null })) }; },
  },
};
export function usePaseo() { return paseo; }

/** Fixture answers per RPC, by the short method name; anything unlisted gets an empty shape. */
const answers: Record<string, unknown> = {
  "connection-health": { connections: [
    { id: "a0", provider: "claude", name: "Studio", email: "demo1@example.com", isActive: true, expiresInMinutes: null, backoffLevel: 0, lastError: "", lastErrorAt: null, modelLocks: [] },
    { id: "a1", provider: "claude", name: "Spare", email: "demo2@example.com", isActive: true, expiresInMinutes: null, backoffLevel: 15, lastError: "429", lastErrorAt: null, modelLocks: [] },
    { id: "a2", provider: "codex", name: "Dev", email: "demo3@example.com", isActive: true, expiresInMinutes: null, backoffLevel: 1, lastError: "", lastErrorAt: null, modelLocks: [] },
  ] },
  "routing-health": { checkedAt: new Date().toISOString(), routerReachable: true, routeAgents: true, showComposerPill: true, healthChecks: true,
    pools: [{ pool: "claude", ready: 1, resting: 1, stuck: 1 }, { pool: "codex", ready: 0, resting: 1, stuck: 0 }],
    stuck: [{ id: "a1", provider: "claude", label: "demo2@example.com", backoffLevel: 15, lastError: "429", lastErrorAt: null }] },
  holds: { count: 1, holds: [{ connectionId: "a0", provider: "claude", model: "cc/claude-opus-5", connectionName: "Studio", status: "parked", until: null, lastError: "429" }] },
  spend: { ok: true, message: null, totals: { label: "last 1d", requests: 12, promptTokens: 1000, completionTokens: 100, cachedTokens: 0, cost: 1.5, lastUsed: null }, byProvider: [], byModel: [], byAccount: [] },
  // Transcript usage: two sessions so the bars, calendar and table all have rows to lay out.
  "transcript-usage": { sessions: [
    { id: "claude:s1", nativeId: "s1", provider: "claude", kind: "main", parentId: null, title: "Routed Claude agent", agentId: "agent-1", agentProvider: "ninerouter", workspaceId: "ws-1", workspace: "paseo-plugin-9router", projectId: "p-1", project: "Paseo plugins", cwd: "", branch: "main", labels: [], archived: false, status: "running", startedAt: "2026-09-10T10:00:00.000Z", endedAt: "2026-09-10T12:00:00.000Z", bytes: 4096, coverage: "available", warnings: [],
      buckets: [{ day: "2026-09-10", model: "cc/claude-opus-5", effort: null, metrics: { inputTokens: 120000, uncachedTokens: 20000, cacheReadTokens: 100000, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 3000, reasoningTokens: null, requests: 12, userMessages: 4, assistantMessages: 12, toolCalls: 9, toolErrors: 1, toolExecutions: null, executionErrors: null, userCharacters: 400, assistantCharacters: 5000, toolInputCharacters: 900, toolOutputCharacters: 12000, compactions: 0, activeMs: 60000, reportedCostUsd: null, estimatedCostUsd: 0.225 }, tools: { Bash: 5, Read: 4 } }] },
    { id: "codex:x1", nativeId: "x1", provider: "codex", kind: "main", parentId: null, title: "Codex 000000000x1", agentId: null, agentProvider: null, workspaceId: null, workspace: "", projectId: null, project: "Outside Paseo / unknown project", cwd: "", branch: "", labels: [], archived: false, status: "untracked", startedAt: "2026-09-09T10:00:00.000Z", endedAt: "2026-09-09T11:00:00.000Z", bytes: 2048, coverage: "available", warnings: [],
      buckets: [{ day: "2026-09-09", model: "gpt-6-astra", effort: "high", metrics: { inputTokens: 50000, uncachedTokens: 10000, cacheReadTokens: 40000, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 2000, reasoningTokens: 500, requests: 5, userMessages: 2, assistantMessages: 5, toolCalls: 3, toolErrors: 0, toolExecutions: 3, executionErrors: 0, userCharacters: 200, assistantCharacters: 3000, toolInputCharacters: 300, toolOutputCharacters: 4000, compactions: 0, activeMs: 30000, reportedCostUsd: null, estimatedCostUsd: 0.24 }, tools: { exec: 3 } }] },
  ], scanning: false, completed: 2, total: 2, checkedAt: new Date().toISOString(), scanMs: 1200, scannedBytes: 6144, warnings: [], missingSessions: 1 },
  "agent-usage": { found: true, scanning: false, checkedAt: new Date().toISOString(), provider: "claude", coverage: "available", warnings: [], startedAt: "2026-09-10T10:00:00.000Z", endedAt: "2026-09-10T12:00:00.000Z", subagents: 1,
    metrics: { inputTokens: 120000, uncachedTokens: 20000, cacheReadTokens: 100000, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 3000, reasoningTokens: null, requests: 12, userMessages: 4, assistantMessages: 12, toolCalls: 9, toolErrors: 1, toolExecutions: null, executionErrors: null, userCharacters: 400, assistantCharacters: 5000, toolInputCharacters: 900, toolOutputCharacters: 12000, compactions: 0, activeMs: 60000, reportedCostUsd: null, estimatedCostUsd: 0.225 },
    byModel: [{ model: "cc/claude-opus-5", metrics: { inputTokens: 120000, uncachedTokens: 20000, cacheReadTokens: 100000, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 3000, reasoningTokens: null, requests: 12, userMessages: 4, assistantMessages: 12, toolCalls: 9, toolErrors: 1, toolExecutions: null, executionErrors: null, userCharacters: 400, assistantCharacters: 5000, toolInputCharacters: 900, toolOutputCharacters: 12000, compactions: 0, activeMs: 60000, reportedCostUsd: null, estimatedCostUsd: 0.225 } }],
    byDay: [{ day: "2026-09-10", metrics: { inputTokens: 120000, uncachedTokens: 20000, cacheReadTokens: 100000, cacheWriteTokens: 0, cacheWrite1hTokens: 0, outputTokens: 3000, reasoningTokens: null, requests: 12, userMessages: 4, assistantMessages: 12, toolCalls: 9, toolErrors: 1, toolExecutions: null, executionErrors: null, userCharacters: 400, assistantCharacters: 5000, toolInputCharacters: 900, toolOutputCharacters: 12000, compactions: 0, activeMs: 60000, reportedCostUsd: null, estimatedCostUsd: 0.225 } }] },
};
const pendingRpc = new Set<() => void>();
/** Resolve every RPC that was asked while the fixtures were absent. */
export function releaseRpc() { for (const release of pendingRpc) release(); pendingRpc.clear(); }
function defaults(schema: any): any {
  const d = schema._zod?.def ?? schema._def;
  if (d.type === "object") return Object.fromEntries(Object.entries(d.shape).map(([key, value]) => [key, defaults(value)]));
  if (d.type === "array") return [];
  if (d.type === "nullable" || d.type === "optional") return null;
  if (d.type === "default") return d.defaultValue;
  if (d.type === "enum") return Object.values(d.entries)[0];
  if (d.type === "literal") return d.values[0];
  if (d.type === "boolean") return false;
  if (d.type === "number") return 0;
  if (d.type === "string") return "";
  if (d.type === "record") return {};
  return null;
}
export function useRpc(contract: any) {
  return useCallback(async (_input: unknown) => {
    if (!ready) await new Promise<void>((resolve) => pendingRpc.add(resolve));
    const name = contract.name.replace("agent-link-9router.router.", "");
    const result = { ...defaults(contract.output), ...((answers[name] as object) ?? {}) };
    if (name === "status") Object.assign(result, { running: true, auth: { configured: true, ok: true, error: null }, binary: { path: "/opt/9router", version: "demo" }, paseo: { listedModels: { claude: [], codex: [] }, modelsInSync: true, staleProviders: [], staleShims: [] } });
    return contract.output.parse(result);
  }, [contract]);
}

export function useSettings(_definition: any) {
  const [state, setState] = useState<any>({ status: "loading" });
  useEffect(() => { if (ready) setState({ status: "ready", values: {}, update: async () => {} }); }, []);
  return state;
}
const passthrough = ({ children }: any) => <View>{children}</View>;
export const SettingsSection = passthrough, SettingsCard = passthrough, SettingsGroup = passthrough;
export const SettingsSwitch = ({ label }: any) => <Text>{label}</Text>;
export const SettingsSelect = ({ label }: any) => <Text>{label}</Text>;
export const SettingsAction = ({ label }: any) => <Text>{label}</Text>;
export function Icon({ name }: { name: string }) { return <Text>{name}</Text>; }
export const Modal = Object.assign(({ children, open }: any) => (open ? <View>{children}</View> : null), { Content: passthrough });
