import React from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { RouterStatus } from "../shared/contracts";
import { Card, Step, Note, Chip, Button } from "./ui";

/**
 * Four sections, four tabs. Before 0.16.0 this was six sections holding
 * fourteen tabs, which made finding anything a hunt. Tabs that answered the
 * same question are merged into one scrolling page: the model catalog now
 * carries the Paseo picker and custom-model registration, Routing carries keys
 * and token settings, and Usage carries the router's figures, the transcript
 * report and the request log. The walkthrough and maintenance content moved
 * into collapsed cards on the pages they describe rather than holding tabs of
 * their own. Nothing was removed.
 */
export const SECTIONS = [
  { id: "overview", label: "Overview", detail: "Status, availability, next step", tabs: [{ id: "overview", label: "Overview", detail: "Check this host, ping the pool, and see what needs attention before making a change." }] },
  { id: "accounts", label: "Accounts", detail: "Quotas, health, and rotation", tabs: [{ id: "accounts", label: "Accounts", detail: "Connect accounts, inspect allowances and holds, and choose how requests are distributed." }] },
  { id: "models", label: "Models", detail: "Catalog, picker, custom models", tabs: [{ id: "models", label: "Models", detail: "Search every model, publish a selection to Paseo, and register custom or missing models. Readiness reflects account state; Test sends a real request." }] },
  { id: "routing", label: "Routing & Access", detail: "CLI paths, keys, token settings", tabs: [{ id: "routing", label: "Routing & Access", detail: "See where tools send requests, manage access keys and fallback chains, and review token settings." }] },
  { id: "health", label: "Usage & Health", detail: "Spend, sessions, failures", tabs: [{ id: "usage", label: "Usage & Health", detail: "What the router billed, what the transcripts add up to per session and workspace, and which requests failed." }] },
  { id: "setup", label: "Setup", detail: "Connection and maintenance", tabs: [{ id: "setup", label: "Setup", detail: "Connect this plugin to the router, read the walkthrough, and review maintenance actions." }] },
] as const;
/**
 * Tabs that no longer have their own entry, mapped to the page that absorbed
 * them. `setTab` routes through this so every existing deep link, Command
 * Center item and in-page button keeps working.
 */
export type TabId = typeof SECTIONS[number]["tabs"][number]["id"];
export const MERGED_TABS = {
  picker: "models", custom: "models",
  keys: "routing", tuning: "routing",
  transcripts: "usage", logs: "usage",
  guide: "setup", powerups: "setup",
} as const satisfies Record<string, TabId>;
/** Every id the surface still accepts: a live tab, or a merged one that resolves to its new home. */
export type AnyTabId = TabId | keyof typeof MERGED_TABS;
/** Resolve a possibly-merged id to the tab that now renders it. */
export function resolveTab(id: AnyTabId): TabId {
  return (MERGED_TABS as Record<string, TabId>)[id] ?? (id as TabId);
}
type Theme = PluginTheme;
export function Navigation({ theme, compact, active, onSelect }: { theme: Theme; compact: boolean; active: TabId; onSelect: (tab: AnyTabId) => void }) {
  const section = SECTIONS.find((section) => section.tabs.some((tab) => tab.id === active))!;
  return <View style={{ gap: 12, marginVertical: 20 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {SECTIONS.map((item) => {
        const selected = section.id === item.id;
        return <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => onSelect(item.tabs[0].id)} style={{ width: compact ? "48%" : "32%", flexGrow: 1, padding: compact ? 12 : 16, borderWidth: 1, borderRadius: 12, borderColor: selected ? theme.colors.accent : theme.colors.border, backgroundColor: theme.colors.surface1, gap: 6 }}>
          <Text style={{ color: selected ? theme.colors.accent : theme.colors.foreground, fontSize: 14, fontWeight: "700" }}>{item.label}</Text>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, lineHeight: 17 }}>{item.detail}</Text>
        </Pressable>;
      })}
    </View>
    {section.tabs.length > 1 ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{section.tabs.map((tab) => <Button key={tab.id} theme={theme} label={tab.label} tone={tab.id === active ? "primary" : "default"} onPress={() => onSelect(tab.id)} />)}</View> : null}
  </View>;
}
export function SectionHeading({ theme, tab }: { theme: Theme; tab: TabId }) {
  const item = SECTIONS.flatMap((section) => [...section.tabs]).find((item) => item.id === tab)!;
  return <View style={{ gap: 6, marginBottom: 18 }}><Text style={{ color: theme.colors.foreground, fontSize: 24, fontWeight: "700" }}>{item.label}</Text><Note theme={theme}>{item.detail}</Note></View>;
}
/** One model's readiness as the router reports it, for the pool card below. */
type Availability = { id: string; label: string; state: "ready" | "limited" | "resting" | "none"; accounts: number; usable: number; readyAt: string | null; detail: string };

/**
 * Can the pool serve anything right now? The router knows per model and per
 * account, and until 0.16.0 that answer was only on the Models page. When
 * nothing can serve, it is the most useful fact on the surface, so it belongs
 * where you land. **Check now** re-asks the router rather than waiting for the
 * 15-second poll.
 */
function PoolReadiness({ theme, models, checking, onPing, onSelect }: { theme: Theme; models: Availability[] | null; checking: boolean; onPing: () => void; onSelect: (tab: AnyTabId) => void }) {
  const ready = models?.filter((model) => model.state === "ready") ?? [];
  const blocked = models?.filter((model) => model.state !== "ready") ?? [];
  const tone = models === null ? "neutral" : ready.length > 0 ? "success" : "warning";
  const label = models === null ? "Not checked yet" : ready.length > 0 ? `${ready.length} of ${models.length} ready` : models.length ? "Nothing can serve" : "No models listed";
  return <Card theme={theme}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Step theme={theme} index={0} title="Can the pool serve right now?" />
      <Chip theme={theme} label={label} tone={tone} />
    </View>
    {models === null ? (
      <Note theme={theme}>Press Check now to ask the router which models an account can serve.</Note>
    ) : ready.length === 0 && models.length > 0 ? (
      <Note theme={theme} tone="warning">
        Every listed model is rate-limited, resting or unserved. New routed sessions will fail until an account recovers or its backoff is reset.
      </Note>
    ) : (
      <Note theme={theme}>Readiness reflects reported account state, not a guarantee. Test a model in the catalog to send a real request.</Note>
    )}
    {blocked.slice(0, 6).map((model) => (
      <View key={model.id} style={{ gap: 3, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>{model.label}</Text>
          <Chip theme={theme} label={model.state === "limited" ? "rate-limited" : model.state === "resting" ? "resting" : "no account"} tone={model.state === "none" ? "neutral" : "warning"} />
        </View>
        <Note theme={theme}>{model.usable}/{model.accounts} accounts usable{model.detail ? ` · ${model.detail}` : ""}</Note>
      </View>
    ))}
    {blocked.length > 6 ? <Note theme={theme}>…and {blocked.length - 6} more on the Models page.</Note> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button theme={theme} label="Check now" tone="primary" busy={checking} onPress={onPing} />
      {blocked.length > 0 ? <Button theme={theme} label="Reset backoff in Accounts" onPress={() => onSelect("accounts")} /> : null}
      <Button theme={theme} label="Open model catalog" onPress={() => onSelect("models")} />
    </View>
  </Card>;
}

export function Overview({ theme, compact, data, onSelect, refresh, refreshing, openDashboard, dashboardBusy, availability, availabilityChecking, onPing }: { theme: Theme; compact: boolean; data?: RouterStatus; onSelect: (tab: AnyTabId) => void; refresh: () => void; refreshing: boolean; openDashboard: () => void; dashboardBusy: boolean; availability?: Availability[] | null; availabilityChecking?: boolean; onPing?: () => void }) {
  const live = data?.running && data.auth.ok;
  const next: { title: string; detail: string; label: string; tab: AnyTabId } = !data?.binary.path
    ? { title: "Connect your first router", detail: "Install 9router on this Paseo host, then save its connection in Host setup.", label: "Open host setup", tab: "setup" }
    : !live ? { title: "Finish the router connection", detail: "Start the router and save its dashboard password to read accounts and models.", label: "Check connection setup", tab: "setup" }
    : data.connections.length === 0 ? { title: "Connect a provider account", detail: "Add an account so 9Router can serve models. Sign-in stays in your normal browser.", label: "Connect an account", tab: "accounts" }
    : !data.paseo.modelsInSync ? { title: "Put your models in Paseo", detail: "Review the catalog and sync your selection. Choose 9Router in a new session to use the pool.", label: "Review picker setup", tab: "picker" }
    : { title: "Ready for a routed session", detail: "Create a new Paseo session and select the 9Router provider. Direct providers remain a separate choice.", label: "Browse models", tab: "models" };
  return <>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
      {[{ label: "Router", value: live ? "Connected" : data?.running ? "Needs sign-in" : "Offline", detail: "On the selected Paseo host" }, { label: "Accounts", value: live ? String(data?.connections.length ?? 0) : "—", detail: "Connected provider accounts" }, { label: "Models", value: live ? String(data?.models.count ?? 0) : "—", detail: "Listed by this router" }].map((metric) => <View key={metric.label} style={{ width: compact ? "100%" : "31%", flexGrow: 1 }}><Card theme={theme}><Note theme={theme}>{metric.label}</Note><Text style={{ color: theme.colors.foreground, fontSize: 28, fontWeight: "700" }}>{metric.value}</Text><Note theme={theme}>{metric.detail}</Note></Card></View>)}
    </View>
    <Card theme={theme}><Chip theme={theme} label="Your next step" tone="success" /><Step theme={theme} index={0} title={next.title} /><Note theme={theme}>{next.detail}</Note><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button theme={theme} label={next.label} tone="primary" onPress={() => onSelect(next.tab)} /><Button theme={theme} label="Copy dashboard link" busy={dashboardBusy} onPress={openDashboard} /><Button theme={theme} label="Read the walkthrough" onPress={() => onSelect("guide")} /><Button theme={theme} label="Refresh status" busy={refreshing} onPress={refresh} /></View></Card>
    {live && onPing ? <PoolReadiness theme={theme} models={availability ?? null} checking={!!availabilityChecking} onPing={onPing} onSelect={onSelect} /> : null}
    {(data?.warnings.length ?? 0) > 0 ? <Card theme={theme}><Step theme={theme} index={0} title="Needs attention" />{data!.warnings.map((warning) => <View key={warning.id} style={{ gap: 4 }}><Text style={{ color: theme.colors.statusWarning, fontSize: 14, fontWeight: "600" }}>{warning.title}</Text><Note theme={theme}>{warning.detail}</Note></View>)}<Button theme={theme} label="Inspect host checks" onPress={() => onSelect("setup")} /></Card> : null}
    <Card theme={theme}><Step theme={theme} index={0} title="Where requests go" /><Note theme={theme}>Choosing the 9Router provider in Paseo routes that session through the account pool. Routing a CLI in Host setup is a separate, machine-wide change.</Note>{data?.hijack.map((cli) => <View key={cli.cli} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Text style={{ color: theme.colors.foreground, fontSize: 13 }}>{cli.label}</Text><Chip theme={theme} label={!cli.installed ? "Not installed" : cli.routed ? "Via 9Router" : "Direct provider"} tone={cli.routed ? "success" : "neutral"} /></View>)}<Button theme={theme} label="Inspect CLI & network" onPress={() => onSelect("routing")} /></Card>
  </>;
}
const FEATURES: { title: string; detail: string; tab?: AnyTabId }[] = [
  { title: "Account sign-in and quotas", detail: "Connect accounts and inspect allowances and spend caps.", tab: "accounts" },
  { title: "Rotation, priorities, and holds", detail: "Choose which account answers and why it is resting.", tab: "accounts" },
  { title: "Model catalog and tests", detail: "Find every model and explicitly test access.", tab: "models" },
  { title: "Astra, custom models, and aliases", detail: "Register models and map short names to routed IDs.", tab: "custom" },
  { title: "Paseo picker selection", detail: "Sync every model or a chosen shortlist.", tab: "picker" },
  { title: "Keys and fallback combos", detail: "Create named access keys and ordered model chains.", tab: "keys" },
  { title: "Token savings", detail: "RTK, prompt styles, Headroom, and sticky request settings.", tab: "tuning" },
  { title: "CLI tools, proxies, and pxpipe", detail: "Inspect direct and routed traffic and optional helpers.", tab: "routing" },
  { title: "Usage and daily trends", detail: "Requests, tokens, account usage, and estimated costs.", tab: "usage" },
  { title: "Sessions, workspaces and agents", detail: "Tokens and estimated cost per session, project, workspace, model or day, read from transcripts. Includes traffic that bypasses the router.", tab: "transcripts" },
  { title: "Failed requests and console", detail: "Read request status, errors, and router diagnostics.", tab: "logs" },
  { title: "Remote dashboard and Tailscale", detail: "Review access options on the selected host.", tab: "setup" },
  { title: "Version updates and optional fixes", detail: "Review maintenance actions before applying them.", tab: "powerups" },
  { title: "Other dashboard features", detail: "Open the installed dashboard for additional providers, media, translation, skills, and advanced controls. Availability varies by version." },
];
export function Guide({ theme, onSelect, openDashboard }: { theme: Theme; onSelect: (tab: AnyTabId) => void; openDashboard: () => void }) {
  return <>
    {[{ title: "Connect this host", detail: "Install and start 9router on the selected host. Save its URL and dashboard password in Host setup. These are router credentials, separate from your Paseo sign-in.", tab: "setup" as const, label: "Open host setup" }, { title: "Add an account", detail: "Connect Claude or Codex under Accounts, then finish sign-in in your normal browser. Other providers can be added through the router dashboard.", tab: "accounts" as const, label: "Open accounts" }, { title: "Choose models for Paseo", detail: "Search the catalog, optionally choose a shortlist, then sync in Paseo picker. Add GPT-6 Astra under Astra & custom models if missing. Registration does not guarantee account access.", tab: "models" as const, label: "Browse model catalog" }, { title: "Start a routed session", detail: "Create a new Paseo session and select the 9Router provider and model. Keep direct Codex or Claude providers for vendor access. Machine-wide CLI routing is optional.", tab: "picker" as const, label: "Review picker setup" }].map((step, index) => <Card key={step.title} theme={theme}><Step theme={theme} index={index + 1} title={step.title} /><Note theme={theme}>{step.detail}</Note><Button theme={theme} label={step.label} onPress={() => onSelect(step.tab)} /></Card>)}
    <Card theme={theme}><Step theme={theme} index={0} title="Find a feature" /><Note theme={theme}>Opening a section does not apply its settings.</Note>{FEATURES.map((feature) => <View key={feature.title} style={{ gap: 6, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 12 }}><Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "600" }}>{feature.title}</Text><Note theme={theme}>{feature.detail}</Note><Button theme={theme} label={feature.tab ? `Go to ${feature.title.toLowerCase()}` : "Copy dashboard link"} onPress={() => feature.tab ? onSelect(feature.tab) : openDashboard()} /></View>)}</Card>
    <Card theme={theme}><Step theme={theme} index={0} title="When something does not work" /><Note theme={theme}>Missing model: refresh the catalog, add it if necessary, then sync the picker. Listed but failing: check account health, quota and spend caps, then failed requests. Model Test uses provider quota; browsing does not send a completion.</Note><Note theme={theme}>A remote router's localhost belongs to that server. Review Host setup → Remote dashboard before opening its URL on another device. This plugin's SSH forward runs on the selected host.</Note><Note theme={theme}>Readiness is based on reported account state, not a guarantee of model access. Direct provider access is valid and does not need to be “fixed.”</Note><Button theme={theme} label="Inspect failed requests" onPress={() => onSelect("logs")} /></Card>
  </>;
}
