import React from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { RouterStatus } from "../shared/contracts";
import { Card, Step, Note, Chip, Button } from "./ui";

export const SECTIONS = [
  { id: "overview", label: "Overview", detail: "Status and your next step", tabs: [{ id: "overview", label: "Overview", detail: "Check this host before making a change." }] },
  { id: "accounts", label: "Accounts", detail: "Quotas, health, and rotation", tabs: [{ id: "accounts", label: "Accounts", detail: "Connect accounts, inspect allowances, and choose how requests are distributed." }] },
  { id: "models", label: "Models", detail: "Find, test, and add to Paseo", tabs: [
    { id: "models", label: "Model catalog", detail: "Search every model. Readiness reflects account state; Test sends a real request." },
    { id: "picker", label: "Paseo picker", detail: "Publish your selection to the separate 9Router provider in Paseo." },
    { id: "custom", label: "Astra & custom models", detail: "Register missing models and map aliases to exact routed IDs." },
  ] },
  { id: "routing", label: "Routing & Access", detail: "CLI paths, keys, and token settings", tabs: [
    { id: "routing", label: "CLI & network", detail: "See where tools send requests and manage optional network helpers." },
    { id: "keys", label: "API keys & combos", detail: "Manage client access keys and ordered model fallback chains." },
    { id: "tuning", label: "Token settings", detail: "Review compression, prompt styles, and routing preferences." },
  ] },
  { id: "health", label: "Usage & Health", detail: "Usage trends and request failures", tabs: [
    { id: "usage", label: "Usage & costs", detail: "Read daily trends and API-equivalent costs. Estimates are not invoices." },
    { id: "logs", label: "Requests & logs", detail: "Inspect failures and read the router console for troubleshooting." },
  ] },
  { id: "setup", label: "Guide & Setup", detail: "Connection, walkthrough, maintenance", tabs: [
    { id: "guide", label: "How it works", detail: "Start your first routed session or find the right feature for a task." },
    { id: "setup", label: "Host setup", detail: "Connect this plugin to the router and review optional machine-wide settings." },
    { id: "powerups", label: "Maintenance", detail: "Inspect optional fixes and version adjustments before applying them." },
  ] },
] as const;
export type TabId = typeof SECTIONS[number]["tabs"][number]["id"];
type Theme = PluginTheme;
export function Navigation({ theme, compact, active, onSelect }: { theme: Theme; compact: boolean; active: TabId; onSelect: (tab: TabId) => void }) {
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
export function Overview({ theme, compact, data, onSelect, refresh, refreshing }: { theme: Theme; compact: boolean; data?: RouterStatus; onSelect: (tab: TabId) => void; refresh: () => void; refreshing: boolean }) {
  const live = data?.running && data.auth.ok;
  const next: { title: string; detail: string; label: string; tab: TabId } = !data?.binary.path
    ? { title: "Connect your first router", detail: "Install 9router on this Paseo host, then save its connection in Host setup.", label: "Open host setup", tab: "setup" }
    : !live ? { title: "Finish the router connection", detail: "Start the router and save its dashboard password to read accounts and models.", label: "Check connection setup", tab: "setup" }
    : data.connections.length === 0 ? { title: "Connect a provider account", detail: "Add an account so 9Router can serve models. Sign-in stays in your normal browser.", label: "Connect an account", tab: "accounts" }
    : !data.paseo.modelsInSync ? { title: "Put your models in Paseo", detail: "Review the catalog and sync your selection. Choose 9Router in a new session to use the pool.", label: "Review picker setup", tab: "picker" }
    : { title: "Ready for a routed session", detail: "Create a new Paseo session and select the 9Router provider. Direct providers remain a separate choice.", label: "Browse models", tab: "models" };
  return <>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
      {[{ label: "Router", value: live ? "Connected" : data?.running ? "Needs sign-in" : "Offline", detail: "On the selected Paseo host" }, { label: "Accounts", value: live ? String(data?.connections.length ?? 0) : "—", detail: "Connected provider accounts" }, { label: "Models", value: live ? String(data?.models.count ?? 0) : "—", detail: "Listed by this router" }].map((metric) => <View key={metric.label} style={{ width: compact ? "100%" : "31%", flexGrow: 1 }}><Card theme={theme}><Note theme={theme}>{metric.label}</Note><Text style={{ color: theme.colors.foreground, fontSize: 28, fontWeight: "700" }}>{metric.value}</Text><Note theme={theme}>{metric.detail}</Note></Card></View>)}
    </View>
    <Card theme={theme}><Chip theme={theme} label="Your next step" tone="success" /><Step theme={theme} index={0} title={next.title} /><Note theme={theme}>{next.detail}</Note><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button theme={theme} label={next.label} tone="primary" onPress={() => onSelect(next.tab)} /><Button theme={theme} label="Read the walkthrough" onPress={() => onSelect("guide")} /><Button theme={theme} label="Refresh status" busy={refreshing} onPress={refresh} /></View></Card>
    {(data?.warnings.length ?? 0) > 0 ? <Card theme={theme}><Step theme={theme} index={0} title="Needs attention" />{data!.warnings.map((warning) => <View key={warning.id} style={{ gap: 4 }}><Text style={{ color: theme.colors.statusWarning, fontSize: 14, fontWeight: "600" }}>{warning.title}</Text><Note theme={theme}>{warning.detail}</Note></View>)}<Button theme={theme} label="Inspect host checks" onPress={() => onSelect("setup")} /></Card> : null}
    <Card theme={theme}><Step theme={theme} index={0} title="Where requests go" /><Note theme={theme}>Choosing the 9Router provider in Paseo routes that session through the account pool. Routing a CLI in Host setup is a separate, machine-wide change.</Note>{data?.hijack.map((cli) => <View key={cli.cli} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Text style={{ color: theme.colors.foreground, fontSize: 13 }}>{cli.label}</Text><Chip theme={theme} label={!cli.installed ? "Not installed" : cli.routed ? "Via 9Router" : "Direct provider"} tone={cli.routed ? "success" : "neutral"} /></View>)}<Button theme={theme} label="Inspect CLI & network" onPress={() => onSelect("routing")} /></Card>
  </>;
}
const FEATURES: { title: string; detail: string; tab?: TabId }[] = [
  { title: "Account sign-in and quotas", detail: "Connect accounts and inspect allowances and spend caps.", tab: "accounts" },
  { title: "Rotation, priorities, and holds", detail: "Choose which account answers and why it is resting.", tab: "accounts" },
  { title: "Model catalog and tests", detail: "Find every model and explicitly test access.", tab: "models" },
  { title: "Astra, custom models, and aliases", detail: "Register models and map short names to routed IDs.", tab: "custom" },
  { title: "Paseo picker selection", detail: "Sync every model or a chosen shortlist.", tab: "picker" },
  { title: "Keys and fallback combos", detail: "Create named access keys and ordered model chains.", tab: "keys" },
  { title: "Token savings", detail: "RTK, prompt styles, Headroom, and sticky request settings.", tab: "tuning" },
  { title: "CLI tools, proxies, and pxpipe", detail: "Inspect direct and routed traffic and optional helpers.", tab: "routing" },
  { title: "Usage and daily trends", detail: "Requests, tokens, account usage, and estimated costs.", tab: "usage" },
  { title: "Failed requests and console", detail: "Read request status, errors, and router diagnostics.", tab: "logs" },
  { title: "Remote dashboard and Tailscale", detail: "Review access options on the selected host.", tab: "setup" },
  { title: "Version updates and optional fixes", detail: "Review maintenance actions before applying them.", tab: "powerups" },
  { title: "Other dashboard features", detail: "Open the installed dashboard for additional providers, media, translation, skills, and advanced controls. Availability varies by version." },
];
export function Guide({ theme, onSelect, openDashboard }: { theme: Theme; onSelect: (tab: TabId) => void; openDashboard: () => void }) {
  return <>
    {[{ title: "Connect this host", detail: "Install and start 9router on the selected host. Save its URL and dashboard password in Host setup. These are router credentials, separate from your Paseo sign-in.", tab: "setup" as const, label: "Open host setup" }, { title: "Add an account", detail: "Connect Claude or Codex under Accounts, then finish sign-in in your normal browser. Other providers can be added through the router dashboard.", tab: "accounts" as const, label: "Open accounts" }, { title: "Choose models for Paseo", detail: "Search the catalog, optionally choose a shortlist, then sync in Paseo picker. Add GPT-6 Astra under Astra & custom models if missing. Registration does not guarantee account access.", tab: "models" as const, label: "Browse model catalog" }, { title: "Start a routed session", detail: "Create a new Paseo session and select the 9Router provider and model. Keep direct Codex or Claude providers for vendor access. Machine-wide CLI routing is optional.", tab: "picker" as const, label: "Review picker setup" }].map((step, index) => <Card key={step.title} theme={theme}><Step theme={theme} index={index + 1} title={step.title} /><Note theme={theme}>{step.detail}</Note><Button theme={theme} label={step.label} onPress={() => onSelect(step.tab)} /></Card>)}
    <Card theme={theme}><Step theme={theme} index={0} title="Find a feature" /><Note theme={theme}>Opening a section does not apply its settings.</Note>{FEATURES.map((feature) => <View key={feature.title} style={{ gap: 6, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 12 }}><Text style={{ color: theme.colors.foreground, fontSize: 14, fontWeight: "600" }}>{feature.title}</Text><Note theme={theme}>{feature.detail}</Note><Button theme={theme} label={feature.tab ? `Go to ${feature.title.toLowerCase()}` : "Open router dashboard"} onPress={() => feature.tab ? onSelect(feature.tab) : openDashboard()} /></View>)}</Card>
    <Card theme={theme}><Step theme={theme} index={0} title="When something does not work" /><Note theme={theme}>Missing model: refresh the catalog, add it if necessary, then sync the picker. Listed but failing: check account health, quota and spend caps, then failed requests. Model Test uses provider quota; browsing does not send a completion.</Note><Note theme={theme}>A remote router's localhost belongs to that server. Review Host setup → Remote dashboard before opening its URL on another device. This plugin's SSH forward runs on the selected host.</Note><Note theme={theme}>Readiness is based on reported account state, not a guarantee of model access. Direct provider access is valid and does not need to be “fixed.”</Note><Button theme={theme} label="Inspect failed requests" onPress={() => onSelect("logs")} /></Card>
  </>;
}
