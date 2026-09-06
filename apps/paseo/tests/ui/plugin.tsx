import React from "react";
import { View, Text } from "react-native";
import { useCallback } from "react";
export function defineRpc<T>(contract: T) { return contract; }
const params = new URLSearchParams(location.search);
const empty = params.has("empty"), offline = params.has("offline"), failed = params.has("error");
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
  return contract.output.parse(result);
}
export function useRpc(contract: any) { return useCallback((input: unknown) => call(contract, input), [contract]); }

export const Modal = Object.assign(({ children, open, title }: any) => open ? <View role="dialog" aria-label={title} style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" }}><View style={{ maxWidth: 520, padding: 20, backgroundColor: "#1a2029" }}><Text style={{ color: "#eef1f6", fontSize: 18 }}>{title}</Text>{children}</View></View> : null, { Content: ({ children }: any) => <View>{children}</View> });
