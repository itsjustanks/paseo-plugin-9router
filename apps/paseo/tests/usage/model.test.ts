/**
 * Adapted from panrafal/paseo-plugins `session-usage/server/model.test.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * The effort-sorting, CSV and label-grouping cases are dropped with the
 * features; the table-group cases are rewritten against `groupRows`.
 * Run through tests/usage.mjs, which transpiles for Node 20.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMetrics, type Session } from "../../shared/usage-schema";
import { aggregate, chartGroups, EMPTY_FILTERS, filterSessions, metricValue, sortRows, dateRange, groupRows, sortGroups, formatMetric } from "../../shared/usage-model";
import { calendarActivity, calendarPeriod, selectCalendarDay, toggleCalendarDay } from "../../shared/usage-calendar";

export function fixture(id: string, provider: "claude" | "codex" = "claude"): Session {
  return { id, nativeId: id, provider, kind: "main", parentId: null, title: id, agentId: id, agentProvider: provider, workspaceId: "w", workspace: "Workspace", projectId: "p", project: "Project", cwd: "/project", branch: "main", labels: ["work"], archived: false, status: "idle", startedAt: "2026-09-01T00:00:00Z", endedAt: "2026-09-03T00:00:00Z", bytes: 1000, coverage: "available", warnings: [], buckets: [
    { day: "2026-09-01", model: "model-a", metrics: { ...emptyMetrics(), inputTokens: 100, cacheReadTokens: 90, outputTokens: 20, toolCalls: 10, toolErrors: 1 }, tools: { Bash: 10 } },
    { day: "2026-09-02", model: "model-b", metrics: { ...emptyMetrics(), inputTokens: 900, cacheReadTokens: 90, outputTokens: 50, toolCalls: 10, toolErrors: 0 }, tools: { Read: 10 } },
  ] };
}
test("date and model filters select activity buckets, not entire session lifetimes", () => {
  const rows = filterSessions([fixture("a")], { ...EMPTY_FILTERS, period: "custom", from: "2026-09-02", to: "2026-09-02", models: ["model-b"] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].metrics.inputTokens, 900);
  assert.equal(metricValue(rows[0], "totalTokens"), 950);
  assert.equal(metricValue(rows[0], "durationMs"), 2 * 86_400_000);
  assert.equal(filterSessions([fixture("a")], { ...EMPTY_FILTERS, period: "custom", from: "2026-09-02", models: ["model-a"] }).length, 0);
});
test("weighted percentages, per-session averages and missing coverage remain correct", () => {
  const a = fixture("a"), b = fixture("b", "codex"), missing = fixture("missing");
  a.buckets.splice(1); b.buckets.splice(0, 1); missing.buckets = []; missing.coverage = "missing";
  const rows = filterSessions([a, b, missing], EMPTY_FILTERS);
  assert.equal(aggregate(rows, "cacheRate").value, 0.18);
  assert.deepEqual(aggregate(rows, "inputTokens"), { value: 1000, known: 2, total: 3 });
  assert.equal(aggregate(rows, "inputTokens", true).value, 500);
  assert.equal(aggregate([rows[2]], "inputTokens").value, null);
  assert.equal(sortRows(rows, "inputTokens", "asc").at(-1)?.session.id, "missing");
  assert.equal(sortRows(rows, "inputTokens", "desc").at(-1)?.session.id, "missing");
});
test("chart buckets conserve totals and combine weekly sessions before averaging", () => {
  const rows = filterSessions([fixture("a"), fixture("b", "codex")], EMPTY_FILTERS);
  const groups = chartGroups(rows, "day");
  assert.equal(groups.length, 2);
  assert.equal(groups.reduce((sum, g) => sum + aggregate([...g.claude, ...g.codex], "totalTokens").value!, 0), aggregate(rows, "totalTokens").value);
  const weeks = chartGroups(rows, "week");
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].id, "2026-08-31");
  assert.equal(aggregate(weeks[0].claude, "inputTokens", true).value, 1000);
});
test("project, archived, label, provider, source and missing-data filters compose", () => {
  const a = fixture("a"), b = fixture("b", "codex"); b.archived = true;
  assert.equal(filterSessions([a, b], { ...EMPTY_FILTERS, providers: ["codex"], projects: ["p"], archived: "archived", labels: ["work"] })[0].session.id, "b");
  assert.equal(filterSessions([a, b], { ...EMPTY_FILTERS, source: "external" }).length, 0);
  assert.equal(filterSessions([a, b], { ...EMPTY_FILTERS, labels: ["personal"] }).length, 0);
});
test("date validation rejects impossible dates and reversed ranges", () => {
  assert.ok(dateRange({ ...EMPTY_FILTERS, period: "custom", from: "2026-02-30" }).error);
  assert.ok(dateRange({ ...EMPTY_FILTERS, period: "custom", from: "2026-09-02", to: "2026-09-01" }).error);
  assert.equal(dateRange({ ...EMPTY_FILTERS, period: "7d" }, Date.parse("2026-09-07T12:00:00Z")).from, "2026-09-01");
});

test("calendar selection filters the report without narrowing the calendar or changing its scale", () => {
  const sessions = [fixture("a"), fixture("b", "codex")];
  const filters = { ...EMPTY_FILTERS, providers: ["codex"], models: ["model-a", "model-b"] };
  const before = calendarActivity(sessions, filters, "totalTokens", false, "2026-09-01", "2026-09-30");
  const selected = selectCalendarDay(filters, "2026-09-01");
  assert.equal(filterSessions(sessions, selected)[0].metrics.inputTokens, 100);
  assert.equal(before.max, 950);
  assert.equal(before.days.get("2026-09-01")?.intensity, 120 / 950);
  assert.equal(before.days.get("2026-09-02")?.intensity, 1);
  assert.equal(before.days.get("2026-09-02")?.total, 1);
  assert.deepEqual(calendarActivity(sessions, selected, "totalTokens", false, "2026-09-01", "2026-09-30"), before);
  assert.deepEqual(calendarActivity(sessions, { ...selected, from: "invalid" }, "totalTokens", false, "2026-09-01", "2026-09-30"), before);
  assert.equal(filterSessions(sessions, selectCalendarDay(filters, "2026-09-03")).length, 0);
  assert.deepEqual(selected.providers, filters.providers);
  assert.deepEqual(selected.models, filters.models);
});

test("daily calendar values combine model and effort buckets before averaging and preserve unknowns", () => {
  const a = fixture("a"), b = fixture("b", "codex");
  b.buckets = [{ ...b.buckets[1], day: "2026-09-01" }];
  a.buckets.push({ ...a.buckets[0], effort: "high" });
  a.buckets[1].metrics = emptyMetrics();
  a.buckets.push({ ...a.buckets[0], day: "unknown" });
  const totals = calendarActivity([a, b], EMPTY_FILTERS, "inputTokens", false, "2026-09-01", "2026-09-30");
  assert.equal(totals.days.get("2026-09-01")?.value, 1100);
  assert.equal(totals.days.get("2026-09-01")?.total, 2);
  assert.equal(totals.days.get("2026-09-02")?.value, null);
  assert.equal(totals.days.get("2026-09-02")?.known, 0);
  assert.equal(totals.days.has("unknown"), false);
  assert.equal(totals.days.has("2026-09-03"), false);
  assert.equal(calendarActivity([a, b], EMPTY_FILTERS, "inputTokens", true, "2026-09-01", "2026-09-30").days.get("2026-09-01")?.value, 550);
  assert.equal(calendarActivity([a, b], EMPTY_FILTERS, "cacheRate", true, "2026-09-01", "2026-09-30").days.get("2026-09-01")?.value, 270 / 1100);
  assert.equal(calendarActivity([a, b], EMPTY_FILTERS, "bytes", false, "2026-09-01", "2026-09-30").days.get("2026-09-01")?.value, null);
  assert.equal(calendarActivity([a, b], { ...EMPTY_FILTERS, models: ["model-a"] }, "inputTokens", false, "2026-09-01", "2026-09-30").max, 200);
});

test("calendar periods include leap days, complete months and Monday-first padded weeks", () => {
  const year = calendarPeriod("2024-02-29", false);
  assert.equal(year.from, "2023-03-01");
  assert.equal(year.to, "2024-02-29");
  assert.equal(year.weeks.flat().filter((day) => day >= year.from && day <= year.to).length, 366);
  assert.equal(new Date(year.weeks[0][0]).getUTCDay(), 1);
  assert.ok(year.weeks.every((week) => week.length === 7));
  const previous = calendarPeriod("2024-02-29", false, -1);
  assert.equal(previous.to, "2023-02-28");
  const february = calendarPeriod("2024-03-31", true, -1);
  assert.equal(february.from, "2024-02-01");
  assert.equal(february.to, "2024-02-29");
  assert.equal(calendarPeriod("2026-01-31", true, -1).from, "2025-12-01");
  const longMonth = calendarPeriod("2026-03-31", true);
  assert.equal(longMonth.weeks.length, 6);
  assert.equal(longMonth.weeks[0][0], "2026-02-23");
  assert.equal(longMonth.weeks.at(-1)?.at(-1), "2026-04-05");
});

test("selecting the active calendar day again clears only date filters, including the Today preset", () => {
  const filters = { ...EMPTY_FILTERS, providers: ["codex"], labels: ["work"] };
  const selected = toggleCalendarDay(filters, "2026-09-01");
  assert.deepEqual(toggleCalendarDay(selected, "2026-09-01"), filters);
  assert.equal(toggleCalendarDay(selected, "2026-09-02").from, "2026-09-02");
  assert.deepEqual(toggleCalendarDay({ ...filters, period: "today" }, "2026-09-01", Date.parse("2026-09-01T12:00:00Z")), filters);
});

test("table groups aggregate every metric with weighted percentages and independent member counts", () => {
  const a = fixture("a"), b = fixture("b"), missing = fixture("missing", "codex");
  a.buckets.splice(1); b.buckets.splice(0, 1); missing.buckets = []; missing.coverage = "missing";
  const rows = filterSessions([a, b, missing], EMPTY_FILTERS);
  const project = groupRows(rows, "project")[0];
  assert.deepEqual(project.values.sessions, { value: 3, known: 3, total: 3 });
  assert.deepEqual(project.values.inputTokens, { value: 1000, known: 2, total: 3 });
  assert.equal(project.values.cacheRate.value, 0.18);
  assert.equal(project.values.totalTokens.value, 1070);
  // Lifetime values sum once per member; the missing row has a span but no bytes.
  assert.deepEqual(project.values.bytes, { value: 2000, known: 2, total: 3 });
  assert.equal(project.values.durationMs.value, 6 * 86_400_000);
  const sessions = groupRows(rows, "session");
  assert.equal(sessions.length, 3);
  assert.equal(sortGroups(sessions, "inputTokens", "asc").at(-1)?.id, "missing");
  assert.equal(sortGroups(sessions, "inputTokens", "desc").at(-1)?.id, "missing");
  assert.equal(groupRows(rows, "workspace")[0].label, "Workspace");
});

test("day and model table groups split selected activity without duplicating metrics", () => {
  const session = fixture("mixed"), missing = fixture("missing");
  session.buckets.push({ ...session.buckets[0], effort: "high" });
  missing.buckets = []; missing.coverage = "missing";
  const rows = filterSessions([session, missing], EMPTY_FILTERS);
  for (const grouping of ["day", "model"] as const) {
    const groups = groupRows(rows, grouping);
    assert.equal(groups.reduce((sum, g) => sum + (g.values.inputTokens.value ?? 0), 0), 1100);
    assert.ok(groups.every((g) => g.values.bytes.value === null && g.values.durationMs.value === null));
    assert.ok(groups.some((g) => g.label.startsWith("Unknown") && g.rows.some((r) => r.session.id === "missing")));
  }
  const selected = filterSessions([session], { ...EMPTY_FILTERS, period: "custom", from: "2026-09-02", to: "2026-09-02" });
  assert.equal(groupRows(selected, "model").length, 1);
  assert.equal(groupRows(selected, "model")[0].values.inputTokens.value, 900);
});

test("formatting keeps unknowns as a dash and USD to cents when compact", () => {
  assert.equal(formatMetric("inputTokens", null), "—");
  assert.equal(formatMetric("estimatedCostUsd", 1.23456, true), "$1.23");
  assert.equal(formatMetric("cacheRate", 0.5), "50.0%");
  assert.equal(formatMetric("activeMs", 3_725_000), "1h 2m");
});
