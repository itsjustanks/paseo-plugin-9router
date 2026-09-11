/**
 * Adapted from panrafal/paseo-plugins `session-usage/shared/schema.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * Shapes for transcript-derived usage. Every figure is a known subtotal or
 * null; null means "the transcript did not record this", never zero.
 */
import { z } from "zod";

const measurement = z.number().finite().nonnegative().nullable();
export const MetricsSchema = z.object({
  inputTokens: measurement,
  uncachedTokens: measurement,
  cacheReadTokens: measurement,
  cacheWriteTokens: measurement,
  cacheWrite1hTokens: measurement,
  outputTokens: measurement,
  reasoningTokens: measurement,
  requests: measurement,
  userMessages: measurement,
  assistantMessages: measurement,
  toolCalls: measurement,
  toolErrors: measurement,
  toolExecutions: measurement,
  executionErrors: measurement,
  userCharacters: measurement,
  assistantCharacters: measurement,
  toolInputCharacters: measurement,
  toolOutputCharacters: measurement,
  compactions: measurement,
  activeMs: measurement,
  reportedCostUsd: measurement,
  estimatedCostUsd: measurement,
});
export type Metrics = z.infer<typeof MetricsSchema>;
export type MetricKey = keyof Metrics;
export const METRIC_KEYS = Object.keys(MetricsSchema.shape) as MetricKey[];
export function emptyMetrics(): Metrics {
  return Object.fromEntries(METRIC_KEYS.map((key) => [key, null])) as Metrics;
}
/** Null is unknown. Aggregates are known subtotals; callers display coverage. */
export function addMetrics(target: Metrics, source: Metrics): Metrics {
  for (const key of METRIC_KEYS) {
    if (source[key] !== null) target[key] = (target[key] ?? 0) + source[key]!;
  }
  return target;
}
export const BucketSchema = z.object({
  day: z.string(), // UTC YYYY-MM-DD, or "unknown" for undated records.
  model: z.string(),
  effort: z.string().nullable().optional(), // Omitted by older snapshots; null when unrecorded.
  metrics: MetricsSchema,
  tools: z.record(z.string(), z.number().int().nonnegative()),
});
export type Bucket = z.infer<typeof BucketSchema>;
export const SessionSchema = z.object({
  id: z.string(),
  nativeId: z.string(),
  provider: z.enum(["claude", "codex"]),
  kind: z.enum(["main", "subagent"]),
  parentId: z.string().nullable(),
  title: z.string(),
  agentId: z.string().nullable(),
  /** The Paseo provider id of the owning agent (`claude`, `ninerouter`, `codex-auto`, …), or null when untracked. */
  agentProvider: z.string().nullable(),
  workspaceId: z.string().nullable(),
  workspace: z.string(),
  projectId: z.string().nullable(),
  project: z.string(),
  cwd: z.string(),
  branch: z.string(),
  labels: z.array(z.string()),
  archived: z.boolean(),
  status: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  bytes: z.number().nonnegative(),
  coverage: z.enum(["available", "partial", "missing"]),
  warnings: z.array(z.string()),
  buckets: z.array(BucketSchema),
});
export type Session = z.infer<typeof SessionSchema>;
export const SnapshotSchema = z.object({
  sessions: z.array(SessionSchema),
  scanning: z.boolean(),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** When the last completed scan finished; null until the first one has. */
  checkedAt: z.string().nullable(),
  /** Wall time of the last completed scan, so the UI can say what a refresh costs. */
  scanMs: z.number().nonnegative().nullable(),
  /** Bytes of transcript the last completed scan covered (parsed or served from cache). */
  scannedBytes: z.number().nonnegative(),
  warnings: z.array(z.string()),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
