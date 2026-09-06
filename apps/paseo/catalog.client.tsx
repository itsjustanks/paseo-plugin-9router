import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { Button, Card, Chip, Field, Note } from "./ui.client";
import { catalogPage, type CatalogSort, type ModelReadiness } from "./catalog.logic";
export function ModelCatalog({ theme, compact, ids, availability, selected, live, selectionReady, testPending, testing, onTest, onToggle }: { theme: PluginTheme; compact: boolean; ids: string[]; availability: ModelReadiness[]; selected: string[]; live: boolean; selectionReady: boolean; testPending: boolean; testing?: string; onTest: (id: string) => void; onToggle: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>("model");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const result = catalogPage(ids, availability, query, sort, descending, page);
  const changeSort = (column: CatalogSort) => { setDescending(column === sort ? !descending : false); setSort(column); setPage(0); };
  return <Card theme={theme}>
    <Field theme={theme} value={query} onChangeText={(value) => { setQuery(value); setPage(0); }} placeholder="Search every model, provider, or readiness state" />
    <Note theme={theme}>{selected.length ? `${selected.length} models shortlisted. Changes are saved; sync them in Paseo picker to update its menu.` : "All models will sync. Add a model to Shortlist to start a smaller selection; an empty shortlist means all models."}</Note>
    <Note theme={theme}>Test sends a small real completion and uses provider quota. Account readiness is a reported state, not a successful test.</Note>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      {([ ["model", "Model"], ["provider", "Provider"], ["state", "Readiness"] ] as const).map(([column, label]) => <Pressable key={column} accessibilityRole="button" accessibilityLabel={`Sort by ${label.toLowerCase()}`} onPress={() => changeSort(column)} style={{ flex: column === "model" && !compact ? 1 : undefined, width: compact ? undefined : column === "provider" ? 90 : column === "state" ? 130 : undefined, padding: 8 }}><Text style={{ color: sort === column ? theme.colors.accent : theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" }}>{label}{sort === column ? descending ? " ↓" : " ↑" : ""}</Text></Pressable>)}
      {!compact ? <Text style={{ color: theme.colors.foregroundMuted, width: 178, fontSize: 12 }}>Shortlist / request test</Text> : null}
    </View>
    {!live ? <Note theme={theme} tone="warning">Connect the router in Host setup to read current models.</Note> : null}
    {result.rows.map((model) => <View key={model.id} style={{ flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.colors.border }}>
      <Text selectable style={{ color: theme.colors.foreground, fontSize: 13, flex: compact ? undefined : 1, minWidth: 0 }}>{model.id}</Text>
      <View style={{ width: compact ? undefined : 90 }}><Note theme={theme}>{model.provider}</Note></View>
      <View style={{ width: compact ? undefined : 130, alignItems: "flex-start", gap: 4 }}><Chip theme={theme} label={model.state} tone={model.state === "ready" ? "success" : model.state === "limited" ? "danger" : model.state === "resting" ? "warning" : "neutral"} />{model.accounts !== null ? <Note theme={theme}>{model.usable}/{model.accounts} accounts</Note> : null}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, width: compact ? undefined : 178 }}><Button theme={theme} label={selected.includes(model.id) ? "Remove" : "Shortlist"} disabled={!live || !selectionReady} onPress={() => onToggle(model.id)} /><Button theme={theme} label="Test" disabled={!live || testPending} busy={testPending && testing === model.id} onPress={() => onTest(model.id)} /></View>
    </View>)}
    {!result.rows.length ? <Note theme={theme}>{query ? "No models match. Try a model name, provider prefix, or clear your search." : "No models listed yet. Connect an account, then refresh the catalog in Paseo picker."}</Note> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}><Note theme={theme}>{result.total ? `${result.page * 12 + 1}–${Math.min((result.page + 1) * 12, result.total)}` : "0"} of {result.total} models · Page {result.page + 1}/{result.pages}</Note><View style={{ flexDirection: "row", gap: 8 }}><Button theme={theme} label="Previous models" disabled={result.page === 0} onPress={() => setPage(result.page - 1)} /><Button theme={theme} label="Next models" disabled={result.page + 1 === result.pages} onPress={() => setPage(result.page + 1)} /></View></View>
  </Card>;
}
