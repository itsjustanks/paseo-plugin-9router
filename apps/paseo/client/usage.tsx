/**
 * Transcript usage: the one view of 9Router that is per session, per workspace
 * and per agent.
 *
 * Adapted from panrafal/paseo-plugins `session-usage/client/charts.tsx`,
 * `client/activity-calendar.tsx` and parts of `client/usage-surface.tsx`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * Kept: the provider comparison bars on one zero-based scale, the GitHub-style
 * activity calendar, and the filter/aggregate model behind them. Dropped: the
 * dropdown kit, the 40-row paginated table, nine-way grouping and CSV export;
 * 9Router's own chips, cards and rows are used instead.
 *
 * Two sources are shown side by side and never blended: what 9router recorded
 * for routed traffic, and what the transcripts add up to at base API prices.
 * The second is an estimate and is labelled as one everywhere it appears.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { routerAgentUsage, routerTranscriptUsage, type SpendRowSchema } from "../shared/contracts";
import type { z } from "zod";
import type { Metrics, Session } from "../shared/usage-schema";
import { addMetrics, emptyMetrics } from "../shared/usage-schema";
import { PRICING_DATE } from "../shared/usage-pricing";
import {
  CHART_METRICS, EMPTY_FILTERS, METRICS, TABLE_GROUPINGS, aggregate, chartGroups, dateRange, filterSessions, formatMetric, groupRows, metricValue, sortGroups,
  type DisplayMetric, type Filters, type Grouping, type SessionRow, type TableGrouping,
} from "../shared/usage-model";
import { calendarActivity, calendarPeriod, toggleCalendarDay } from "../shared/usage-calendar";
import { Button, Card, Chip, Note, Row, Step } from "./ui";

type Theme = PluginTheme;
type SpendRow = z.infer<typeof SpendRowSchema>;

export const TRANSCRIPT_USAGE_QUERY_KEY = ["agent-link-9router", "transcript-usage"] as const;

/** The periods the section offers; `null` days means everything 9router and the transcripts have. */
export const USAGE_PERIODS = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
] as const;
export type UsagePeriod = typeof USAGE_PERIODS[number]["id"];

const CHART_GROUPS: { id: Grouping; label: string }[] = [
  { id: "provider", label: "Provider" }, { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "project", label: "Project" }, { id: "model", label: "Model" },
];
const TABLE_COLUMNS: DisplayMetric[] = ["totalTokens", "cacheRate", "requests", "toolCalls", "estimatedCostUsd", "activeMs"];
const TABLE_PAGE = 25;

/** A row of small selectable pills, the same shape as the surface's 7d/14d/30d switch. */
function Pills<T extends string>({ theme, options, value, onChange }: { theme: Theme; options: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: selected ? theme.colors.accent : theme.colors.surface1,
              borderColor: theme.colors.border,
              borderWidth: selected ? 0 : 1,
            }}
          >
            <Text style={{ color: selected ? theme.colors.accentForeground : theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The snapshot, polled fast while the server is scanning and slowly otherwise. */
export function useTranscriptUsage() {
  const list = useRpc(routerTranscriptUsage);
  return useQuery({
    queryKey: TRANSCRIPT_USAGE_QUERY_KEY,
    queryFn: () => list({ refresh: false }),
    refetchInterval: (query) => (query.state.data?.scanning ? 2_000 : 30_000),
  });
}

const text = (theme: Theme) => ({ color: theme.colors.foreground, fontSize: 13 });
const muted = (theme: Theme) => ({ color: theme.colors.foregroundMuted, fontSize: 12 });

/** One number the section leads with; "known" says how many sessions had that measurement. */
function Tile({ theme, compact, label, value, caption }: { theme: Theme; compact: boolean; label: string; value: string; caption: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: compact ? "45%" : 160, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, gap: 4, backgroundColor: theme.colors.surface2 }}>
      <Text style={muted(theme)}>{label}</Text>
      <Text style={{ color: theme.colors.foreground, fontSize: compact ? 20 : 24, fontWeight: "600" }}>{value}</Text>
      <Text style={muted(theme)}>{caption}</Text>
    </View>
  );
}

/** Claude vs Codex bars on a shared zero-based scale, grouped by one dimension. */
function ProviderBars({ theme, compact, rows, metric, onMetric }: { theme: Theme; compact: boolean; rows: SessionRow[]; metric: DisplayMetric; onMetric: (metric: DisplayMetric) => void }) {
  const [grouping, setGrouping] = useState<Grouping>("provider");
  const [average, setAverage] = useState(false);
  const [limit, setLimit] = useState(14);
  const groups = useMemo(() => chartGroups(rows, grouping), [rows, grouping]);
  const lifetime = metric === "durationMs" || metric === "bytes";
  const restricted = lifetime && !["provider", "project"].includes(grouping);
  const values = groups.map((group) => ({ group, claude: aggregate(group.claude, metric, average), codex: aggregate(group.codex, metric, average) }));
  const max = Math.max(...values.flatMap((v) => [v.claude.value ?? 0, v.codex.value ?? 0]), 0);
  const temporal = ["day", "week", "month"].includes(grouping);
  const visible = temporal ? values.slice(-limit) : values.slice(0, limit);
  return (
    <Card theme={theme}>
      <Step theme={theme} index={0} title="Compare providers" hint="transcript estimate" />
      <Pills theme={theme} options={CHART_METRICS.map((id) => ({ id, label: METRICS[id].label }))} value={metric} onChange={onMetric} />
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Pills theme={theme} options={CHART_GROUPS} value={grouping} onChange={(next) => { setGrouping(next); setLimit(14); }} />
        <Pills theme={theme} options={[{ id: "total", label: "Total" }, { id: "average", label: "Per session" }] as const} value={average ? "average" : "total"} onChange={(id) => setAverage(id === "average")} />
      </View>
      <Note theme={theme}>{METRICS[metric].description}</Note>
      {restricted ? (
        <Note theme={theme}>Choose Provider or Project for lifetime measurements.</Note>
      ) : visible.length === 0 ? (
        <Note theme={theme}>No sessions match this period.</Note>
      ) : (
        <View style={{ gap: 14 }}>
          {visible.map(({ group, ...series }) => (
            <View key={group.id} style={{ gap: 6 }}>
              {grouping !== "provider" ? <Text style={{ ...text(theme), fontWeight: "600" }}>{group.label}</Text> : null}
              {(["claude", "codex"] as const).map((provider) => {
                const result = series[provider];
                const color = provider === "claude" ? theme.colors.accent : theme.colors.statusSuccess;
                const label = provider === "claude" ? "Claude" : "Codex";
                const fraction = max && result.value !== null ? Math.min(1, result.value / max) : 0;
                return (
                  <View key={provider} accessible accessibilityLabel={`${group.label}, ${label}, ${METRICS[metric].label}: ${formatMetric(metric, result.value)}, ${result.known} of ${result.total} sessions have this measurement`} style={{ gap: 3 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{label}</Text>
                      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                        {formatMetric(metric, result.value, compact)} · {result.known}/{result.total} known
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surface2, overflow: "hidden" }}>
                      <View style={{ height: 6, width: `${Math.max(fraction > 0 ? 1 : 0, fraction * 100)}%`, borderRadius: 3, backgroundColor: color }} />
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
      {!restricted && groups.length > limit ? (
        <Button theme={theme} label={`Showing ${temporal ? "latest " : ""}${visible.length} of ${groups.length} · Show more`} onPress={() => setLimit(limit + 30)} />
      ) : null}
      <Note theme={theme}>Bars start at zero on a shared scale. Values are known subtotals; "—" means the transcript did not record it. Dates are UTC.</Note>
    </Card>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const tintOpacity = (intensity: number) => (intensity > 0 ? 0.16 + 0.84 * intensity : 0);

/** GitHub-style daily calendar. A month on compact layouts, twelve months otherwise; a day press filters the section. */
function ActivityCalendar({ theme, compact, sessions, filters, onChange, metric }: { theme: Theme; compact: boolean; sessions: Session[]; filters: Filters; onChange: (filters: Filters) => void; metric: DisplayMetric }) {
  const [width, setWidth] = useState(0);
  const monthly = compact || (width > 0 && width < 760);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const offset = monthly ? monthOffset : yearOffset;
  const setOffset = monthly ? setMonthOffset : setYearOffset;
  const [inspected, setInspected] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const period = useMemo(() => calendarPeriod(today, monthly, offset), [today, monthly, offset]);
  const activity = useMemo(() => calendarActivity(sessions, filters, metric, false, period.from, period.to > today ? today : period.to), [sessions, filters, metric, period.from, period.to, today]);
  const selectedRange = dateRange(filters);
  const selectedDay = !selectedRange.error && selectedRange.from && selectedRange.from === selectedRange.to ? selectedRange.from : null;
  const detailDay = inspected ?? (selectedDay && selectedDay >= period.from && selectedDay <= period.to ? selectedDay : null);
  const lifetime = metric === "durationMs" || metric === "bytes";
  const cellHeight = 0.8 * (monthly ? 44 : Math.min(24, Math.max(12, ((width || 950) - (compact ? 26 : 34) - 30 - 3 * period.weeks.length) / period.weeks.length)));
  const heading = monthly ? new Date(period.from).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }) : `${period.from} – ${period.to}`;
  function describe(day: string): string {
    if (day > today) return `${day} · future`;
    const result = activity.days.get(day);
    if (!result) return `${day} · no recorded activity`;
    if (lifetime) return `${day} · ${result.total} sessions · this metric covers the full session`;
    return `${day} · ${formatMetric(metric, result.value)} ${METRICS[metric].label.toLocaleLowerCase()} · ${result.known}/${result.total} sessions known`;
  }
  function renderDay(day: string) {
    if (day < period.from || day > period.to) return <View key={day} style={{ height: cellHeight, flex: monthly ? 1 : undefined }} />;
    const result = activity.days.get(day);
    const future = day > today;
    const unknown = Boolean(result && result.value === null);
    const selected = selectedDay === day;
    return (
      <Pressable
        key={day}
        testID={`activity-day-${day}`}
        accessibilityRole="button"
        accessibilityLabel={describe(day)}
        accessibilityHint={selected ? "Clear the date filter" : "Filter this section to this UTC day"}
        accessibilityState={{ selected, disabled: future }}
        disabled={future}
        onPress={() => onChange(toggleCalendarDay(filters, day))}
        onHoverIn={() => setInspected(day)}
        onHoverOut={() => setInspected(null)}
        onFocus={() => setInspected(day)}
        onBlur={() => setInspected(null)}
        style={{ height: cellHeight, flex: monthly ? 1 : undefined, borderRadius: monthly ? 6 : 3, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: selected ? 2 : 1, borderStyle: unknown && !selected ? "dashed" : "solid", borderColor: selected ? theme.colors.foreground : theme.colors.border, backgroundColor: theme.colors.surface2, opacity: future ? 0.35 : 1 }}
      >
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.accent, opacity: tintOpacity(result?.intensity ?? 0) }} />
        {monthly ? <Text style={{ ...text(theme), fontSize: 12, minWidth: 22, textAlign: "center", paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4, backgroundColor: theme.colors.surface1, fontWeight: selected ? "700" : "400" }}>{Number(day.slice(-2))}</Text> : null}
      </Pressable>
    );
  }
  const navButton = { minHeight: 32, paddingHorizontal: 10, justifyContent: "center" as const, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6 };
  return (
    <Card theme={theme}>
      <View testID="activity-calendar" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Step theme={theme} index={0} title="Daily activity" hint={`${METRICS[metric].label} · UTC`} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${monthly ? "month" : "year"}`} onPress={() => { setOffset(offset - 1); setInspected(null); }} style={navButton}><Text style={text(theme)}>‹</Text></Pressable>
            <Text testID="activity-period" style={{ ...text(theme), fontWeight: "600", fontSize: 12 }}>{heading}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Next ${monthly ? "month" : "year"}`} disabled={offset >= 0} accessibilityState={{ disabled: offset >= 0 }} onPress={() => { setOffset(Math.min(0, offset + 1)); setInspected(null); }} style={[navButton, { opacity: offset >= 0 ? 0.4 : 1 }]}><Text style={text(theme)}>›</Text></Pressable>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <Note theme={theme}>Press a day to filter the section; press it again to clear. The calendar itself ignores the period filter.</Note>
          {offset !== 0 ? <Button theme={theme} label={monthly ? "Current month" : "Last 12 months"} onPress={() => { setOffset(0); setInspected(null); }} /> : null}
          {selectedDay ? <Button theme={theme} label="Clear day" onPress={() => onChange({ ...filters, period: "all", from: "", to: "" })} /> : null}
        </View>
        {lifetime ? <Note theme={theme}>Session span and transcript size cannot be split by day. Choose another metric above to colour the calendar.</Note> : null}
        {monthly ? (
          <View testID="activity-month-grid" style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>{WEEKDAYS.map((day) => <Text key={day} style={{ ...muted(theme), flex: 1, textAlign: "center" }}>{day}</Text>)}</View>
            {period.weeks.map((week) => <View key={week[0]} style={{ flexDirection: "row", gap: 6 }}>{week.map(renderDay)}</View>)}
          </View>
        ) : (
          <View testID="activity-year-grid" style={{ flexDirection: "row", gap: 3 }}>
            <View style={{ width: 30, gap: 3 }}><View style={{ height: 18 }} />{WEEKDAYS.map((day) => <View key={day} style={{ height: cellHeight, justifyContent: "center" }}><Text style={{ ...muted(theme), fontSize: 10 }}>{day}</Text></View>)}</View>
            {period.weeks.map((week, index) => {
              const labelDay = week.find((day) => day >= period.from && day <= period.to && (index === 0 || day.endsWith("-01")));
              return (
                <View key={week[0]} style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ height: 18 }}>{labelDay ? <Text numberOfLines={1} style={{ ...muted(theme), position: "absolute", width: Math.min(55, (period.weeks.length - index) * (cellHeight + 3)), fontSize: 10 }}>{new Date(labelDay).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}</Text> : null}</View>
                  {week.map(renderDay)}
                </View>
              );
            })}
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text testID="activity-day-detail" style={{ ...muted(theme), flexShrink: 1 }}>{detailDay ? describe(detailDay) : selectedDay ? `Section filtered to ${selectedDay}` : "Hover or select a day for details."}</Text>
          <View accessible accessibilityLabel={`Colour scale from zero to ${formatMetric(metric, activity.max)} ${METRICS[metric].label}`} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={muted(theme)}>Less</Text>
            {[0, 0.25, 0.5, 0.75, 1].map((intensity) => <View key={intensity} style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: "hidden" }}><View style={{ flex: 1, backgroundColor: theme.colors.accent, opacity: tintOpacity(intensity) }} /></View>)}
            <Text style={muted(theme)}>More · {formatMetric(metric, activity.max, true)}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/** Grouped totals. Sessions open their agent where the host supports navigation. */
function UsageTable({ theme, compact, rows, navigation }: { theme: Theme; compact: boolean; rows: SessionRow[]; navigation: PluginSurfaceProps["navigation"] }) {
  const [grouping, setGrouping] = useState<TableGrouping>("session");
  const [sort, setSort] = useState<DisplayMetric>("totalTokens");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(TABLE_PAGE);
  const groups = useMemo(() => sortGroups(groupRows(rows, grouping), sort, direction), [rows, grouping, sort, direction]);
  const visible = groups.slice(0, limit);
  const columns: DisplayMetric[] = grouping === "session" ? TABLE_COLUMNS : ["sessions", ...TABLE_COLUMNS];
  const firstWidth = compact ? 150 : 240;
  const cellWidth = 118;
  const header = (key: DisplayMetric) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${METRICS[key].label}${sort === key ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
      onPress={() => { if (sort === key) setDirection(direction === "desc" ? "asc" : "desc"); else { setSort(key); setDirection("desc"); } setLimit(TABLE_PAGE); }}
      style={{ width: cellWidth, paddingHorizontal: 8, paddingVertical: 10, justifyContent: "center" }}
    >
      <Text numberOfLines={2} style={{ ...muted(theme), fontWeight: "600", textAlign: "right", color: sort === key ? theme.colors.accent : theme.colors.foregroundMuted }}>
        {METRICS[key].label}{sort === key ? (direction === "desc" ? " ↓" : " ↑") : ""}
      </Text>
    </Pressable>
  );
  const rowStyle = (index: number) => ({ height: 52, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: index % 2 ? theme.colors.surface1 : theme.colors.surface0 });
  return (
    <Card theme={theme}>
      <Step theme={theme} index={0} title="By session, project, workspace, model or day" hint="transcript estimate" />
      <Pills theme={theme} options={TABLE_GROUPINGS} value={grouping} onChange={(next) => { setGrouping(next); setLimit(TABLE_PAGE); }} />
      <Note theme={theme}>
        Press a column to sort. "—" means unknown. Model and day groups split a session's activity and so cannot carry its lifetime span or size.
        {grouping === "session" && navigation ? " Press a session to open its agent." : ""}
      </Note>
      {groups.length === 0 ? <Note theme={theme}>No sessions match this period.</Note> : (
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, overflow: "hidden" }}>
          <View style={{ width: firstWidth, flexShrink: 0, borderRightWidth: 1, borderRightColor: theme.colors.border }}>
            <View style={{ height: 44, paddingHorizontal: 10, justifyContent: "center", backgroundColor: theme.colors.surface2 }}>
              <Text style={{ ...muted(theme), fontWeight: "600" }}>{TABLE_GROUPINGS.find((option) => option.id === grouping)!.label}</Text>
            </View>
            {visible.map((group, index) => {
              const agentId = grouping === "session" ? group.rows[0].session.agentId : null;
              const openable = Boolean(navigation && agentId);
              return (
                <Pressable
                  key={group.id}
                  accessibilityRole={openable ? "button" : undefined}
                  accessibilityLabel={openable ? `Open agent for ${group.label}` : group.label}
                  disabled={!openable}
                  onPress={() => { if (navigation && agentId) navigation.openAgent({ agentId }); }}
                  style={{ ...rowStyle(index), paddingHorizontal: 10, justifyContent: "center", gap: 3 }}
                >
                  <Text numberOfLines={1} style={{ ...text(theme), fontWeight: "600", color: openable ? theme.colors.accent : theme.colors.foreground }}>{group.label}</Text>
                  <Text numberOfLines={1} style={{ ...muted(theme), fontSize: 11 }}>{group.detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView horizontal style={{ flex: 1, minWidth: 0 }}>
            <View>
              <View style={{ flexDirection: "row", height: 44, backgroundColor: theme.colors.surface2 }}>{columns.map(header)}</View>
              {visible.map((group, index) => (
                <View key={group.id} style={{ ...rowStyle(index), flexDirection: "row" }}>
                  {columns.map((key) => {
                    const result = group.values[key];
                    const partial = result.known < result.total && key !== "sessions";
                    return (
                      <View key={key} accessible accessibilityLabel={`${METRICS[key].label}: ${formatMetric(key, result.value)}${partial ? `, ${result.known} of ${result.total} known` : ""}`} style={{ width: cellWidth, paddingHorizontal: 8, justifyContent: "center", gap: 2 }}>
                        <Text style={{ ...text(theme), textAlign: "right", fontVariant: ["tabular-nums"] }}>{formatMetric(key, result.value, true)}</Text>
                        {partial ? <Text style={{ ...muted(theme), fontSize: 10, textAlign: "right" }}>{result.known}/{result.total} known</Text> : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      {groups.length > limit ? <Button theme={theme} label={`Showing ${visible.length} of ${groups.length} · Show more`} onPress={() => setLimit(limit + TABLE_PAGE)} /> : null}
    </Card>
  );
}

/** What 9router recorded for the same period, for the side-by-side card. */
export interface RouterSpendView {
  loading: boolean;
  ok: boolean;
  message: string | null;
  totals: SpendRow | null;
}

/**
 * The Usage & Health → Sessions & agents tab. Owns the transcript query and
 * every filter; the surface hands it the router's figures for the same period.
 */
export function TranscriptUsageSection({ theme, compact, navigation, period, onPeriod, router, live }: {
  theme: Theme;
  compact: boolean;
  navigation: PluginSurfaceProps["navigation"];
  period: UsagePeriod;
  onPeriod: (period: UsagePeriod) => void;
  router: RouterSpendView;
  /** Whether the router is reachable; the transcript side works without it. */
  live: boolean;
}) {
  const list = useRpc(routerTranscriptUsage);
  const query = useTranscriptUsage();
  const [metric, setMetric] = useState<DisplayMetric>("totalTokens");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const sessions = query.data?.sessions ?? [];
  // The period pills set the filter unless a calendar day has been chosen; the day wins until cleared.
  const effective = useMemo<Filters>(() => {
    const day = dateRange(filters);
    if (!day.error && day.from && day.from === day.to) return filters;
    return { ...filters, period: period === "all" ? "all" : period, from: "", to: "" };
  }, [filters, period]);
  const rows = useMemo(() => filterSessions(sessions, effective), [sessions, effective]);
  const selectedDay = (() => { const range = dateRange(effective); return !range.error && range.from && range.from === range.to ? range.from : null; })();
  const totals = {
    tokens: aggregate(rows, "totalTokens"),
    output: aggregate(rows, "outputTokens"),
    cache: aggregate(rows, "cacheRate"),
    requests: aggregate(rows, "requests"),
    cost: aggregate(rows, "estimatedCostUsd"),
  };
  const linked = rows.filter((row) => row.session.agentId).length;
  const scanning = query.data?.scanning ?? false;
  const refresh = async () => {
    setRefreshError(null);
    try { await list({ refresh: true }); await query.refetch(); }
    catch { setRefreshError("Could not start a transcript scan. Try again."); }
  };
  const money = (value: number) => `$${value.toFixed(2)}`;
  return (
    <>
      <Card theme={theme}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Step theme={theme} index={0} title="Two sources, one period" />
          <Pills theme={theme} options={USAGE_PERIODS} value={period} onChange={onPeriod} />
          <Button theme={theme} label="Rescan transcripts" busy={scanning} disabled={scanning} onPress={() => void refresh()} />
        </View>
        <Note theme={theme}>
          9router records each request's provider, model, account and API key; every Paseo session shares one key, so the router cannot say which
          session, agent or workspace a request belonged to. Local Claude Code and Codex transcripts can, and they also cover terminal sessions that
          bypass the router. The two columns below will not agree, and should not: they count different traffic and price it differently.
        </Note>
        <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, backgroundColor: theme.colors.surface2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ ...text(theme), fontWeight: "600", flex: 1 }}>Router billed</Text>
              <Chip theme={theme} label="9router" tone="success" />
            </View>
            <Note theme={theme}>Routed requests only, as 9router recorded them. Its cost figure is the router's own API-equivalent for the traffic it served.</Note>
            {!live ? <Note theme={theme} tone="warning">Router not connected; finish Setup to compare.</Note> : router.loading ? <ActivityIndicator color={theme.colors.accent} /> : !router.ok ? <Note theme={theme} tone="warning">{router.message ?? "9router did not return usage."}</Note> : router.totals ? (
              <View style={{ gap: 5 }}>
                <Row theme={theme} label="Requests" value={formatMetric("requests", router.totals.requests, true)} />
                <Row theme={theme} label="Tokens in / out" value={`${formatMetric("inputTokens", router.totals.promptTokens, true)} / ${formatMetric("outputTokens", router.totals.completionTokens, true)}`} />
                <Row theme={theme} label="Cached tokens" value={formatMetric("cacheReadTokens", router.totals.cachedTokens, true)} />
                <Row theme={theme} label="Cost (9router's figure)" value={money(router.totals.cost)} />
              </View>
            ) : <Note theme={theme}>No routed traffic in this period.</Note>}
          </View>
          <View style={{ flex: 1, gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, backgroundColor: theme.colors.surface2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ ...text(theme), fontWeight: "600", flex: 1 }}>Transcript estimate</Text>
              <Chip theme={theme} label="base API pricing" tone="warning" />
            </View>
            <Note theme={theme}>
              Every local Claude and Codex session, routed or not, priced from a fixed base-API table ({PRICING_DATE}). Excludes priority processing,
              long-context premiums, tool fees, discounts, tax and plan charges. Not a bill.
            </Note>
            {query.isPending ? <ActivityIndicator color={theme.colors.accent} /> : (
              <View style={{ gap: 5 }}>
                <Row theme={theme} label="Model responses" value={formatMetric("requests", totals.requests.value, true)} />
                <Row theme={theme} label="Tokens in / out" value={`${formatMetric("inputTokens", aggregate(rows, "inputTokens").value, true)} / ${formatMetric("outputTokens", totals.output.value, true)}`} />
                <Row theme={theme} label="Cache hit" value={formatMetric("cacheRate", totals.cache.value)} />
                <Row theme={theme} label="Estimated cost" value={`${formatMetric("estimatedCostUsd", totals.cost.value, true)} · ${totals.cost.known}/${totals.cost.total} priced`} />
              </View>
            )}
          </View>
        </View>
        {query.isPending || scanning ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color={theme.colors.accent} />
            <Note theme={theme}>
              {scanning
                ? `Reading transcripts: ${query.data?.completed ?? 0} / ${query.data?.total || "…"}.${sessions.length ? " Showing the previous completed scan meanwhile." : " The first scan of a large history can take a few minutes."}`
                : "Connecting to the transcript index…"}
            </Note>
          </View>
        ) : null}
        {query.isError || refreshError ? <Note theme={theme} tone="warning">{refreshError ?? "Could not read transcript usage from this host."}</Note> : null}
        {query.data?.warnings.map((warning) => <Note key={warning} theme={theme} tone="warning">{warning}</Note>)}
        {query.data?.checkedAt ? (
          <Text style={{ ...muted(theme), fontSize: 11 }}>
            {rows.length} of {sessions.length} sessions in this period · {linked} linked to a Paseo agent · {query.data.missingSessions} agents without a transcript · indexed {new Date(query.data.checkedAt).toLocaleTimeString()}
            {query.data.scanMs !== null ? ` in ${formatMetric("activeMs", query.data.scanMs)}` : ""} over {formatMetric("bytes", query.data.scannedBytes)}
            {selectedDay ? ` · day ${selectedDay}` : ""}
          </Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <Tile theme={theme} compact={compact} label="Total tokens" value={formatMetric("totalTokens", totals.tokens.value, true)} caption={`${totals.tokens.known}/${totals.tokens.total} sessions known`} />
        <Tile theme={theme} compact={compact} label="Output tokens" value={formatMetric("outputTokens", totals.output.value, true)} caption={`${totals.output.known}/${totals.output.total} sessions known`} />
        <Tile theme={theme} compact={compact} label="Cache hit" value={formatMetric("cacheRate", totals.cache.value)} caption="weighted across known sessions" />
        <Tile theme={theme} compact={compact} label="Transcript estimate" value={formatMetric("estimatedCostUsd", totals.cost.value, true)} caption={`base API pricing · ${totals.cost.known}/${totals.cost.total} priced`} />
      </View>

      <ProviderBars theme={theme} compact={compact} rows={rows} metric={metric} onMetric={setMetric} />
      <ActivityCalendar theme={theme} compact={compact} sessions={sessions} filters={effective} onChange={setFilters} metric={metric} />
      <UsageTable theme={theme} compact={compact} rows={rows} navigation={navigation} />
      <Card theme={theme}>
        <Step theme={theme} index={0} title="How to read these numbers" />
        <Note theme={theme}>
          Claude's base input excludes cache reads and writes, so they are added to give total input; Codex's input already includes them, so they are
          subtracted to give uncached input. Reasoning is part of output and is never added twice. Claude usage is merged per message id; Codex usage is
          deduplicated per response id. A session that a Paseo agent resumed counts once. Message text, tool arguments, tool results and credentials never
          leave the daemon's parser — only counts, token figures and tool names reach this screen.
        </Note>
        <Note theme={theme}>
          Adapted from the session-usage plugin by panrafal (MIT). The standalone plugin offers more dimensions, filters and CSV export.
        </Note>
      </Card>
    </>
  );
}

/**
 * One agent's own transcript, with the subagents it spawned folded in. This is
 * the figure the router can never produce, so the card says where it comes from.
 */
export function AgentUsageCard({ theme, agentId, provider }: { theme: Theme; agentId: string; provider: string }) {
  const call = useRpc(routerAgentUsage);
  const usage = useQuery({
    queryKey: ["agent-link-9router", "agent-usage", agentId],
    queryFn: () => call({ agentId }),
    refetchInterval: (query) => (query.state.data?.scanning ? 2_000 : 30_000),
  });
  const data = usage.data;
  const metrics: Metrics = data?.metrics ?? emptyMetrics();
  const total = metrics.inputTokens === null || metrics.outputTokens === null ? null : metrics.inputTokens + metrics.outputTokens;
  const cacheRate = metrics.cacheReadTokens === null || !metrics.inputTokens ? null : metrics.cacheReadTokens / metrics.inputTokens;
  const byModel = (data?.byModel ?? []).slice(0, 6);
  const recent = (data?.byDay ?? []).slice(-7);
  const covered = ["claude", "codex", "ninerouter", "agent-link", "agent-router"].includes(provider) || provider.startsWith("claude-") || provider.startsWith("codex-");
  return (
    <Card theme={theme}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Step theme={theme} index={0} title="This agent's usage" />
        <Chip theme={theme} label="transcript estimate" tone="warning" />
      </View>
      {usage.isPending ? <ActivityIndicator color={theme.colors.accent} /> : null}
      {usage.isError ? <Note theme={theme} tone="warning">Could not read this agent's transcript usage.</Note> : null}
      {data && !data.found ? (
        <Note theme={theme}>
          {covered
            ? data.scanning
              ? "Transcripts are still being indexed; this agent's numbers appear when the scan reaches it."
              : "No transcript for this agent has been indexed yet. A new session appears after its first reply; press Rescan on the 9Router surface to look now."
            : "This provider's sessions are not read from local transcripts, so 9Router has no per-agent figures for it."}
        </Note>
      ) : null}
      {data?.found ? (
        <>
          <View style={{ gap: 5 }}>
            <Row theme={theme} label="Total tokens" value={formatMetric("totalTokens", total, true)} />
            <Row theme={theme} label="Tokens in / out" value={`${formatMetric("inputTokens", metrics.inputTokens, true)} / ${formatMetric("outputTokens", metrics.outputTokens, true)}`} />
            <Row theme={theme} label="Cache hit" value={formatMetric("cacheRate", cacheRate)} />
            <Row theme={theme} label="Model responses" value={formatMetric("requests", metrics.requests)} />
            <Row theme={theme} label="Tool calls / errors" value={`${formatMetric("toolCalls", metrics.toolCalls)} / ${formatMetric("toolErrors", metrics.toolErrors)}`} />
            <Row theme={theme} label="Recorded turn time" value={formatMetric("activeMs", metrics.activeMs)} />
            <Row theme={theme} label="Estimated cost" value={formatMetric("estimatedCostUsd", metrics.estimatedCostUsd)} tone={metrics.estimatedCostUsd === null ? undefined : "warning"} />
            {data.subagents > 0 ? <Row theme={theme} label="Subagents included" value={String(data.subagents)} /> : null}
            {data.coverage === "partial" ? <Row theme={theme} label="Coverage" value="partial" tone="warning" /> : null}
          </View>
          {byModel.length > 1 ? (
            <View style={{ gap: 4 }}>
              <Text style={{ ...muted(theme), fontWeight: "600" }}>By model</Text>
              {byModel.map((entry) => (
                <Row key={entry.model} theme={theme} label={entry.model} value={`${formatMetric("totalTokens", (entry.metrics.inputTokens ?? 0) + (entry.metrics.outputTokens ?? 0), true)} · ${formatMetric("estimatedCostUsd", entry.metrics.estimatedCostUsd, true)}`} />
              ))}
            </View>
          ) : null}
          {recent.length > 1 ? (
            <View style={{ gap: 4 }}>
              <Text style={{ ...muted(theme), fontWeight: "600" }}>By day (UTC)</Text>
              {recent.map((entry) => {
                const tokens = (entry.metrics.inputTokens ?? 0) + (entry.metrics.outputTokens ?? 0);
                const peak = Math.max(...recent.map((d) => (d.metrics.inputTokens ?? 0) + (d.metrics.outputTokens ?? 0)), 1);
                return (
                  <View key={entry.day} style={{ gap: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ ...muted(theme), fontSize: 11 }}>{entry.day}</Text>
                      <Text style={{ ...muted(theme), fontSize: 11 }}>{formatMetric("totalTokens", tokens, true)} · {formatMetric("estimatedCostUsd", entry.metrics.estimatedCostUsd, true)}</Text>
                    </View>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: "hidden" }}>
                      <View style={{ height: 4, width: `${Math.max(tokens > 0 ? 2 : 0, (tokens / peak) * 100)}%`, backgroundColor: theme.colors.accent }} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          {data.warnings.map((warning) => <Note key={warning} theme={theme} tone="warning">{warning}</Note>)}
          <Note theme={theme}>
            Read from this agent's local {data.provider === "codex" ? "Codex" : "Claude Code"} transcript, not from 9router: the router cannot attribute
            requests to an agent. Cost is an estimate at base API prices ({PRICING_DATE}) and excludes priority processing, long-context premiums and plan
            charges; the router's own figure is under Usage & Health.
            {data.checkedAt ? ` Indexed ${new Date(data.checkedAt).toLocaleTimeString()}.` : ""}
          </Note>
        </>
      ) : null}
    </Card>
  );
}

/** Sum of a set of metrics; exported for the preview fixtures so they stay consistent with the model. */
export function sumMetrics(items: Metrics[]): Metrics {
  return items.reduce((sum, metrics) => addMetrics(sum, metrics), emptyMetrics());
}
