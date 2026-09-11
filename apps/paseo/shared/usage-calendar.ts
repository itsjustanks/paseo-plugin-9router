/**
 * Adapted from panrafal/paseo-plugins `session-usage/shared/calendar.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 */
import { aggregate, chartGroups, dateRange, filterSessions, type DisplayMetric, type Filters } from "./usage-model";
import type { Session } from "./usage-schema";

const DAY_MS = 86_400_000;
const dayString = (time: number) => new Date(time).toISOString().slice(0, 10);
function shiftMonths(day: string, months: number): number {
  const date = new Date(day);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)).getUTCDate();
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, Math.min(date.getUTCDate(), last));
}
export interface CalendarPeriod { from: string; to: string; weeks: string[][] }
/** Monday-first weeks, padded with dates outside the visible range. */
export function calendarPeriod(today: string, monthly: boolean, offset = 0): CalendarPeriod {
  let from: number, to: number;
  if (monthly) {
    const date = new Date(shiftMonths(today, offset));
    from = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    to = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
  } else {
    to = shiftMonths(today, offset * 12);
    from = shiftMonths(dayString(to), -12) + DAY_MS;
  }
  const firstMonday = from - (new Date(from).getUTCDay() + 6) % 7 * DAY_MS;
  const weeks: string[][] = [];
  for (let week = firstMonday; week <= to; week += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, index) => dayString(week + index * DAY_MS)));
  }
  return { from: dayString(from), to: dayString(to), weeks };
}
export interface CalendarValue { value: number | null; known: number; total: number; intensity: number }
/** Date filters never narrow the calendar; all other report filters still apply. */
export function calendarActivity(sessions: Session[], filters: Filters, metric: DisplayMetric, average: boolean, from: string, to: string): { days: Map<string, CalendarValue>; max: number } {
  const rows = filterSessions(sessions, { ...filters, period: "custom", from, to });
  const days = new Map<string, CalendarValue>();
  const lifetime = metric === "durationMs" || metric === "bytes";
  for (const group of chartGroups(rows, "day")) {
    const result = aggregate([...group.claude, ...group.codex], metric, average);
    days.set(group.id, { ...result, value: lifetime ? null : result.value, intensity: 0 });
  }
  let max = 0;
  for (const day of days.values()) max = Math.max(max, day.value ?? 0);
  for (const day of days.values()) day.intensity = max && day.value !== null ? day.value / max : 0;
  return { days, max };
}

export function selectCalendarDay(filters: Filters, day: string): Filters {
  return { ...filters, period: "custom", from: day, to: day };
}
export function toggleCalendarDay(filters: Filters, day: string, now = Date.now()): Filters {
  const range = dateRange(filters, now);
  return !range.error && range.from === day && range.to === day
    ? { ...filters, period: "all", from: "", to: "" }
    : selectCalendarDay(filters, day);
}
