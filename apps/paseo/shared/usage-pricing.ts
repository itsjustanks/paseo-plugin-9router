/**
 * Adapted from panrafal/paseo-plugins `session-usage/shared/pricing.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * 9Router change: a routed session records its model under 9router's alias
 * (`cc/claude-opus-5`), so a provider prefix is stripped before the lookup.
 */
import type { Metrics } from "./usage-schema";

/** Standard, short-context USD/1M token equivalents, checked 2026-09-07.
 * https://developers.openai.com/api/docs/pricing
 * https://platform.claude.com/docs/en/about-claude/pricing
 * Deliberately not a bill: excludes tier/region/long-context premiums and tool fees.
 */
export const PRICING_DATE = "2026-09-07";
type Rates = readonly [input: number, read: number, write: number, write1h: number, output: number];
const RATES: Record<string, Rates> = {
  "gpt-6-astra": [10, 1, 12.5, 12.5, 50],
  "gpt-5.6-sol": [4, 0.4, 5, 5, 20],
  "gpt-5.6-terra": [2, 0.2, 2.5, 2.5, 12],
  "gpt-5.6-luna": [0.2, 0.02, 0.25, 0.25, 1.2],
  "gpt-5.4": [2.5, 0.25, 2.5, 2.5, 15],
  "claude-fable-5-1": [10, 0.25, 12.5, 20, 50],
  "claude-mythos-5-1": [10, 0.25, 12.5, 20, 50],
  "claude-fable-5": [10, 1, 12.5, 20, 50],
  "claude-mythos-5": [10, 1, 12.5, 20, 50],
  "claude-opus-5": [5, 0.5, 6.25, 10, 25],
  "claude-opus-4-8": [5, 0.5, 6.25, 10, 25],
  "claude-opus-4-7": [5, 0.5, 6.25, 10, 25],
  "claude-opus-4-6": [5, 0.5, 6.25, 10, 25],
  "claude-opus-4-5": [5, 0.5, 6.25, 10, 25],
  "claude-opus-4-1": [15, 1.5, 18.75, 30, 75],
  "claude-opus-4": [15, 1.5, 18.75, 30, 75],
  "claude-sonnet-5": [2, 0.2, 2.5, 4, 10],
  "claude-sonnet-4-6": [3, 0.3, 3.75, 6, 15],
  "claude-sonnet-4-5": [3, 0.3, 3.75, 6, 15],
  "claude-sonnet-4": [3, 0.3, 3.75, 6, 15],
  "claude-haiku-4-5": [1, 0.1, 1.25, 2, 5],
  "claude-3-5-haiku": [0.8, 0.08, 1, 1.6, 4],
};

/** The price-table key for a recorded model id: alias prefix and date suffix removed. */
export function pricedModel(model: string): string {
  return model.replace(/^[a-z0-9_-]+\//i, "").replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

export function estimateCost(model: string, metrics: Metrics): number | null {
  const rates = RATES[pricedModel(model)];
  const { uncachedTokens: input, cacheReadTokens: read, cacheWriteTokens: write, outputTokens: output } = metrics;
  if (!rates || input === null || read === null || write === null || output === null) return null;
  const oneHour = metrics.cacheWrite1hTokens ?? 0;
  return (input * rates[0] + read * rates[1] + Math.max(0, write - oneHour) * rates[2] + oneHour * rates[3] + output * rates[4]) / 1_000_000;
}
