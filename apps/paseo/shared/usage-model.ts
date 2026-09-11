/**
 * Adapted from panrafal/paseo-plugins `session-usage/shared/model.ts` and
 * `shared/table.ts` (commit 8d33de5, https://github.com/panrafal/paseo-plugins),
 * MIT License, Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the
 * repository root.
 *
 * Trimmed for 9Router: the metric catalogue, filtering, aggregation, chart
 * grouping and formatting are kept; sorting by effort, CSV export and the
 * nine-way table grouping are not. `groupRows` covers the five groupings the
 * Usage section offers.
 */
import { addMetrics, emptyMetrics, type Bucket, type Metrics, type MetricKey, type Session } from "./usage-schema";

export type DisplayMetric = MetricKey | "totalTokens" | "cacheRate" | "errorRate" | "durationMs" | "bytes" | "sessions";
type Unit = "number" | "usd" | "ms" | "percent" | "bytes";
export const METRICS: Record<DisplayMetric, { label: string; unit: Unit; description: string }> = {
  sessions: { label: "Sessions", unit: "number", description: "Distinct provider sessions. Subagents have their own rows." },
  totalTokens: { label: "Total tokens", unit: "number", description: "Input including cache reads/writes, plus output. Reasoning is already included in output." },
  inputTokens: { label: "Input tokens", unit: "number", description: "All input, including cache reads and writes. Normalized across providers." },
  uncachedTokens: { label: "Uncached input", unit: "number", description: "Input excluding cache reads and cache writes." },
  cacheReadTokens: { label: "Cache read", unit: "number", description: "Input tokens retrieved from cache." },
  cacheWriteTokens: { label: "Cache write", unit: "number", description: "Input tokens written to cache, including 1-hour writes." },
  cacheWrite1hTokens: { label: "1h cache write", unit: "number", description: "Claude's explicitly reported 1-hour cache writes, a subset of cache write tokens." },
  outputTokens: { label: "Output tokens", unit: "number", description: "Output tokens, including reasoning where reported by the provider." },
  reasoningTokens: { label: "Reasoning tokens", unit: "number", description: "Reported reasoning/thinking tokens. A subset of output; unknown when omitted." },
  cacheRate: { label: "Cache hit %", unit: "percent", description: "Cache reads / total input. Aggregates use the ratio of sums for sessions with both values." },
  requests: { label: "Model responses", unit: "number", description: "Unique Claude message IDs or Codex usage responses. Legacy Codex: observed nonzero cumulative increments." },
  userMessages: { label: "User messages", unit: "number", description: "Recorded user messages excluding tool results. May include injected instructions and automated prompts." },
  assistantMessages: { label: "Assistant messages", unit: "number", description: "Unique Claude assistant messages or canonical Codex response messages." },
  toolCalls: { label: "Tool calls", unit: "number", description: "Model-issued calls, including exec wrappers and server tools. Deduplicated by call ID." },
  toolErrors: { label: "Tool errors", unit: "number", description: "Call outputs explicitly flagged as errors or with a nonzero exit code. Unstructured failures may be absent." },
  toolExecutions: { label: "Tool executions", unit: "number", description: "Codex completed command, MCP, file-change and search events, including operations inside exec. Separate from model tool calls." },
  executionErrors: { label: "Execution errors", unit: "number", description: "Codex execution events reporting failure. Separate from errors in model call outputs." },
  errorRate: { label: "Tool error %", unit: "percent", description: "Explicit tool errors / model tool calls. In-flight or unstructured outcomes are not inferred." },
  userCharacters: { label: "User characters", unit: "number", description: "Unicode code points in recorded user text. Not tokenized; images are excluded." },
  assistantCharacters: { label: "Assistant characters", unit: "number", description: "Unicode code points in assistant text, excluding thinking and tool arguments." },
  toolInputCharacters: { label: "Tool input chars", unit: "number", description: "Unicode code points in tool arguments, serialized when structured." },
  toolOutputCharacters: { label: "Tool output chars", unit: "number", description: "Unicode code points in recorded tool output, serialized when structured." },
  compactions: { label: "Compactions", unit: "number", description: "Recorded Claude compact boundaries or Codex compacted records." },
  activeMs: { label: "Recorded turn time", unit: "ms", description: "Sum of recorded completed/aborted turn durations, attributed to completion day. Unknown when not recorded." },
  durationMs: { label: "Session span", unit: "ms", description: "Lifetime from first to last transcript timestamp, including idle time. Always lifetime, even with a date filter." },
  reportedCostUsd: { label: "Reported cost", unit: "usd", description: "USD explicitly recorded in Claude result events. Usually absent in native transcripts; not inferred from subscription plans." },
  estimatedCostUsd: { label: "Transcript estimate", unit: "usd", description: "Token equivalent at standard short-context API prices dated 2026-09-07. Excludes premiums, tool fees, discounts, tax, and subscription billing. Unpriced models are unknown." },
  bytes: { label: "Transcript size", unit: "bytes", description: "Size of the selected transcript file on disk. Always lifetime, even with a date filter." },
};
export const DISPLAY_METRICS = Object.keys(METRICS) as DisplayMetric[];
/** The metrics the Usage section charts; the rest stay in the catalogue for labels and formatting. */
export const CHART_METRICS: DisplayMetric[] = ["totalTokens", "inputTokens", "uncachedTokens", "cacheReadTokens", "cacheWriteTokens", "outputTokens", "cacheRate", "requests", "toolCalls", "toolErrors", "estimatedCostUsd", "activeMs"];

export interface Filters {
  query: string;
  providers: string[];
  projects: string[];
  workspaces: string[];
  labels: string[];
  models: string[];
  archived: "all" | "active" | "archived";
  source: "all" | "paseo" | "external";
  kind: "all" | "main" | "subagent";
  coverage: "all" | "available" | "partial" | "missing";
  period: "all" | "today" | "7d" | "30d" | "90d" | "custom";
  from: string;
  to: string;
}
export const EMPTY_FILTERS: Filters = { query: "", providers: [], projects: [], workspaces: [], labels: [], models: [], archived: "all", source: "all", kind: "all", coverage: "all", period: "all", from: "", to: "" };
export interface SessionRow { session: Session; buckets: Bucket[]; metrics: Metrics }
const DAY_MS = 86_400_000;
export function dateRange(filters: Filters, now = Date.now()): { from: string; to: string; error: string | null } {
  if (filters.period === "all") return { from: "", to: "", error: null };
  if (filters.period === "custom") {
    const valid = (s: string) => !s || (/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
    if (!valid(filters.from) || !valid(filters.to)) return { from: "", to: "", error: "Use valid UTC dates in YYYY-MM-DD format." };
    if (filters.from && filters.to && filters.from > filters.to) return { from: "", to: "", error: "Start date must be on or before end date." };
    return { from: filters.from, to: filters.to, error: null };
  }
  const days = filters.period === "today" ? 1 : Number.parseInt(filters.period, 10);
  return { from: new Date(now - (days - 1) * DAY_MS).toISOString().slice(0, 10), to: new Date(now).toISOString().slice(0, 10), error: null };
}
export function filterSessions(sessions: Session[], filters: Filters, now = Date.now()): SessionRow[] {
  const range = dateRange(filters, now);
  if (range.error) return [];
  const selected = (values: string[], value: string) => !values.length || values.includes(value);
  const inRange = (day: string) => (!range.from && !range.to) || (day !== "unknown" && (!range.from || day >= range.from) && (!range.to || day <= range.to));
  const query = filters.query.trim().toLocaleLowerCase();
  const result: SessionRow[] = [];
  for (const session of sessions) {
    if (!selected(filters.providers, session.provider) || !selected(filters.projects, session.projectId ?? "unknown") || !selected(filters.workspaces, session.workspaceId ?? "unknown")) continue;
    if (filters.labels.length && !session.labels.some((label) => filters.labels.includes(label))) continue;
    if (filters.archived !== "all" && session.archived !== (filters.archived === "archived")) continue;
    if (filters.source !== "all" && Boolean(session.agentId || session.workspaceId) !== (filters.source === "paseo")) continue;
    if (filters.kind !== "all" && filters.kind !== session.kind) continue;
    if (filters.coverage !== "all" && filters.coverage !== session.coverage) continue;
    if (query && ![session.title, session.id, session.agentId, session.project, session.workspace, session.cwd, session.branch, ...session.labels, ...session.buckets.flatMap((b) => [b.model, b.effort])].join(" ").toLocaleLowerCase().includes(query)) continue;
    const buckets = session.buckets.filter((b) => inRange(b.day) && selected(filters.models, b.model));
    if (session.buckets.length && !buckets.length) continue;
    if (!session.buckets.length && (filters.models.length || !inRange(session.startedAt?.slice(0, 10) ?? "unknown"))) continue;
    result.push({ session, buckets, metrics: buckets.reduce((m, b) => addMetrics(m, b.metrics), emptyMetrics()) });
  }
  return result;
}
export function metricValue(row: SessionRow, key: DisplayMetric): number | null {
  const m = row.metrics;
  if (key === "sessions") return 1;
  if (key === "bytes") return row.session.coverage === "missing" ? null : row.session.bytes;
  if (key === "durationMs") return row.session.startedAt && row.session.endedAt ? Math.max(0, Date.parse(row.session.endedAt) - Date.parse(row.session.startedAt)) : null;
  if (key === "totalTokens") return m.inputTokens === null || m.outputTokens === null ? null : m.inputTokens + m.outputTokens;
  if (key === "cacheRate") return m.cacheReadTokens === null || !m.inputTokens ? null : m.cacheReadTokens / m.inputTokens;
  if (key === "errorRate") return m.toolErrors === null || !m.toolCalls ? null : m.toolErrors / m.toolCalls;
  return m[key];
}
export interface Aggregate { value: number | null; known: number; total: number }
export function aggregate(rows: SessionRow[], key: DisplayMetric, average = false): Aggregate {
  const knownRows = rows.filter((r) => metricValue(r, key) !== null);
  let value: number | null = null;
  if (knownRows.length) {
    if (key === "cacheRate" || key === "errorRate") {
      const numerator = key === "cacheRate" ? "cacheReadTokens" : "toolErrors";
      const denominator = key === "cacheRate" ? "inputTokens" : "toolCalls";
      value = knownRows.reduce((sum, r) => sum + r.metrics[numerator]!, 0) / knownRows.reduce((sum, r) => sum + r.metrics[denominator]!, 0);
    } else value = knownRows.reduce((sum, row) => sum + metricValue(row, key)!, 0) / (average ? knownRows.length : 1);
  }
  return { value, known: knownRows.length, total: rows.length };
}
export function sortRows(rows: SessionRow[], key: DisplayMetric | "title" | "endedAt", direction: "asc" | "desc"): SessionRow[] {
  const value = (row: SessionRow): string | number | null => key in METRICS ? metricValue(row, key as DisplayMetric) : row.session[key as "title" | "endedAt"];
  return [...rows].sort((a, b) => {
    const av = value(a), bv = value(b);
    // Missing data sorts last in either direction.
    if (av === null || bv === null) return av === bv ? a.session.id.localeCompare(b.session.id) : av === null ? 1 : -1;
    const order = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return order * (direction === "asc" ? 1 : -1) || a.session.id.localeCompare(b.session.id);
  });
}
export type Grouping = "provider" | "day" | "week" | "month" | "project" | "model";
export interface ChartGroup { id: string; label: string; claude: SessionRow[]; codex: SessionRow[] }
export function chartGroups(rows: SessionRow[], grouping: Grouping): ChartGroup[] {
  const groups = new Map<string, ChartGroup>();
  function put(id: string, label: string, row: SessionRow) {
    let group = groups.get(id);
    if (!group) { group = { id, label, claude: [], codex: [] }; groups.set(id, group); }
    group[row.session.provider].push(row);
  }
  for (const row of rows) {
    if (grouping === "provider") { put("all", "Filtered sessions", row); continue; }
    if (grouping === "project") { put(row.session.projectId ?? "unknown", row.session.project, row); continue; }
    const subsets = new Map<string, Bucket[]>();
    for (const bucket of row.buckets) {
      let key = grouping === "model" ? bucket.model : bucket.day;
      if (grouping === "month" && key !== "unknown") key = key.slice(0, 7);
      if (grouping === "week" && key !== "unknown") {
        const date = new Date(key);
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
        key = date.toISOString().slice(0, 10);
      }
      subsets.set(key, [...(subsets.get(key) ?? []), bucket]);
    }
    for (const [key, buckets] of subsets) put(key, key, { ...row, buckets, metrics: buckets.reduce((m, b) => addMetrics(m, b.metrics), emptyMetrics()) });
  }
  const temporal = ["day", "week", "month"].includes(grouping);
  return [...groups.values()].sort((a, b) => temporal ? a.id.localeCompare(b.id) : a.label.localeCompare(b.label));
}

/** The table's groupings: one row per session, or totals per project, workspace, model or UTC day. */
export type TableGrouping = "session" | "project" | "workspace" | "model" | "day";
export const TABLE_GROUPINGS: { id: TableGrouping; label: string }[] = [
  { id: "session", label: "Session" }, { id: "project", label: "Project" }, { id: "workspace", label: "Workspace" }, { id: "model", label: "Model" }, { id: "day", label: "Day" },
];
export interface TableGroup { id: string; label: string; detail: string; rows: SessionRow[]; values: Record<DisplayMetric, Aggregate> }
/**
 * Group filtered rows for the table. Project/workspace groups sum each member
 * session once; model/day groups split a session's activity buckets, so their
 * metrics conserve the filtered total and lifetime values (span, bytes) are
 * unknown because they cannot be divided across buckets.
 */
export function groupRows(rows: SessionRow[], grouping: TableGrouping): TableGroup[] {
  const members = new Map<string, { label: string; rows: SessionRow[] }>();
  const put = (id: string, label: string, row: SessionRow) => {
    const group = members.get(id) ?? { label, rows: [] };
    group.rows.push(row);
    members.set(id, group);
  };
  const split = grouping === "model" || grouping === "day";
  for (const row of rows) {
    if (grouping === "session") put(row.session.id, row.session.title, row);
    else if (grouping === "project") put(row.session.projectId ?? "unknown", row.session.project, row);
    else if (grouping === "workspace") put(row.session.workspaceId ?? "unknown", row.session.workspace || "No workspace", row);
    else {
      const subsets = new Map<string, Bucket[]>();
      for (const bucket of row.buckets) {
        const key = grouping === "model" ? bucket.model : bucket.day;
        subsets.set(key, [...(subsets.get(key) ?? []), bucket]);
      }
      if (!subsets.size) subsets.set("unknown", []);
      for (const [key, buckets] of subsets) put(key, key === "unknown" ? `Unknown ${grouping}` : key, { ...row, buckets, metrics: buckets.reduce((m, b) => addMetrics(m, b.metrics), emptyMetrics()) });
    }
  }
  return [...members.entries()].map(([id, group]) => {
    const values = Object.fromEntries(DISPLAY_METRICS.map((key) => {
      const lifetime = key === "durationMs" || key === "bytes";
      return [key, split && lifetime ? { value: null, known: 0, total: group.rows.length } : aggregate(group.rows, key)];
    })) as Record<DisplayMetric, Aggregate>;
    const detail = grouping === "session"
      ? [group.rows[0].session.provider === "claude" ? "Claude" : "Codex", group.rows[0].session.archived ? "archived" : "active", group.rows[0].session.kind, group.rows[0].session.coverage].join(" · ")
      : `${group.rows.length} session${group.rows.length === 1 ? "" : "s"}${group.rows.some((r) => r.session.coverage !== "available") ? ` · ${group.rows.filter((r) => r.session.coverage !== "available").length} partial or missing` : ""}`;
    return { id, label: group.label, detail, rows: group.rows, values };
  });
}
export function sortGroups(groups: TableGroup[], key: DisplayMetric, direction: "asc" | "desc"): TableGroup[] {
  return [...groups].sort((a, b) => {
    const av = a.values[key].value, bv = b.values[key].value;
    if (av === null || bv === null) return av === bv ? a.label.localeCompare(b.label) : av === null ? 1 : -1;
    return (av - bv) * (direction === "asc" ? 1 : -1) || a.label.localeCompare(b.label);
  });
}

export function formatMetric(key: DisplayMetric, value: number | null, compact = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const unit = METRICS[key].unit;
  if (unit === "usd") return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: compact ? 2 : 4 })}`;
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "ms") {
    const seconds = Math.round(value / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  }
  if (unit === "bytes") return value >= 1_048_576 ? `${(value / 1_048_576).toFixed(1)} MiB` : `${(value / 1024).toFixed(1)} KiB`;
  return value.toLocaleString(undefined, compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 2 });
}
