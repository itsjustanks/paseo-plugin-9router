/**
 * Adapted from panrafal/paseo-plugins `session-usage/server/parser.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * Reads one Claude Code or Codex transcript and keeps only counters, hashes
 * and identifiers. Message text, tool arguments, tool results and credentials
 * never leave this module; that property is what the tests defend.
 *
 * Token normalisation, which is easy to get wrong: Claude's `input_tokens` is
 * base input *excluding* cache reads/writes, so those are added to give total
 * input. Codex's `input_tokens` already *includes* them, so they are subtracted
 * to give uncached input. See `normalizeUsage`.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { emptyMetrics, addMetrics, type Bucket, type Metrics, type MetricKey } from "../shared/usage-schema";
import { estimateCost } from "../shared/usage-pricing";

type RecordValue = Record<string, unknown>;
export const object = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
export const string = (value: unknown): string => typeof value === "string" ? value : "";
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const hash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value) ?? "").digest("hex");
const timestamp = (value: unknown): string | null => {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
function textLength(value: unknown): number {
  if (typeof value === "string") { let length = 0; for (const _point of value) length++; return length; }
  if (!Array.isArray(value)) return 0;
  return value.reduce((sum, part) => {
    const item = object(part);
    return sum + textLength(item.text ?? item.content);
  }, 0);
}
const serializedLength = (value: unknown) => textLength(typeof value === "string" ? value : JSON.stringify(value) ?? "");
function messageText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => messageText(object(part).text ?? object(part).content)).join("");
}

export interface ParsedTranscript {
  nativeId: string;
  isSubagent?: boolean;
  parentId: string | null;
  cwd: string;
  title: string;
  branch: string;
  startedAt: string | null;
  endedAt: string | null;
  buckets: Bucket[];
  warnings: string[];
}
interface Contribution { day: string; model: string; effort: string | null; metrics: Metrics; tools: Record<string, number> }
function recordedEffort(value: unknown): string | null {
  const effort = string(value).trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{0,31}$/.test(effort) ? effort : null;
}
const TOKEN_KEYS: MetricKey[] = ["inputTokens", "uncachedTokens", "cacheReadTokens", "cacheWriteTokens", "cacheWrite1hTokens", "outputTokens", "reasoningTokens"];
const COUNT_KEYS: MetricKey[] = ["userMessages", "assistantMessages", "toolCalls", "toolErrors", "userCharacters", "assistantCharacters", "toolInputCharacters", "toolOutputCharacters", "compactions"];

export function normalizeUsage(provider: "claude" | "codex", usage: RecordValue): Metrics {
  const m = emptyMetrics();
  const input = number(usage.input_tokens);
  m.outputTokens = number(usage.output_tokens);
  m.cacheReadTokens = number(usage.cache_read_input_tokens ?? usage.cached_input_tokens ?? object(usage.input_tokens_details).cached_tokens);
  m.cacheWriteTokens = number(usage.cache_creation_input_tokens ?? usage.cache_write_input_tokens ?? usage.cache_write_tokens ?? object(usage.input_tokens_details).cache_write_tokens);
  m.reasoningTokens = number(usage.reasoning_output_tokens ?? object(usage.output_tokens_details).reasoning_tokens ?? object(usage.output_tokens_details).thinking_tokens);
  m.cacheWrite1hTokens = provider === "claude" ? number(object(usage.cache_creation).ephemeral_1h_input_tokens) : 0;
  // Both cache categories are disjoint parts of Codex input; Claude reports base input separately.
  if (provider === "claude") {
    m.uncachedTokens = input;
    m.cacheReadTokens ??= input === null ? null : 0;
    m.cacheWriteTokens ??= input === null ? null : 0;
    m.inputTokens = input === null ? null : input + (m.cacheReadTokens ?? 0) + (m.cacheWriteTokens ?? 0);
  } else {
    m.inputTokens = input;
    // Older Codex versions predate cache-write accounting.
    m.cacheWriteTokens ??= input === null ? null : 0;
    m.uncachedTokens = input === null || m.cacheReadTokens === null ? null : Math.max(0, input - m.cacheReadTokens - (m.cacheWriteTokens ?? 0));
  }
  return m;
}

/** Retains only counters, hashes and identifiers; never message bodies or tool arguments. */
export class TranscriptParser {
  private result: ParsedTranscript = { nativeId: "", parentId: null, cwd: "", title: "", branch: "", startedAt: null, endedAt: null, buckets: [], warnings: [] };
  private model = "unknown";
  private effort: string | null = null;
  private day = "unknown";
  private records = new Set<string>();
  private contributions = new Map<string, Contribution>();
  private totalUsage: Metrics | null = null;
  private responseIds = new Set<string>();
  private hasDirectUsage = false;
  private lastLegacy: { id: string; time: string; usage: Metrics } | null = null;
  private legacyIndex = 0;
  private directMessages = new Map<string, number>();
  private fallbackMessages = new Map<string, string>();
  private warnings = new Set<string>();
  private validRecords = 0;
  private turnStartedAt: string | null = null;

  constructor(private provider: "claude" | "codex") {}

  warn(message: string): void { this.warnings.add(message); }
  private contribution(id: string): Contribution {
    let entry = this.contributions.get(id);
    if (!entry) {
      entry = { day: this.day, model: this.model, effort: this.effort, metrics: emptyMetrics(), tools: Object.create(null) as Record<string, number> };
      this.contributions.set(id, entry);
    }
    return entry;
  }
  private add(id: string, key: MetricKey, value: number): void {
    const m = this.contribution(id).metrics;
    m[key] = (m[key] ?? 0) + value;
  }
  private rememberTime(time: string | null): void {
    if (!time) return;
    this.day = time.slice(0, 10);
    if (!this.result.startedAt || time < this.result.startedAt) this.result.startedAt = time;
    if (!this.result.endedAt || time > this.result.endedAt) this.result.endedAt = time;
  }
  accept(raw: unknown): void {
    const r = object(raw);
    if (!string(r.type)) return;
    this.validRecords++;
    this.rememberTime(timestamp(r.timestamp));
    const id = string(r.uuid) || (r.ordinal !== undefined ? `ordinal:${r.ordinal}` : hash(r));
    if (this.records.has(id)) return;
    this.records.add(id);
    if (this.provider === "claude") this.claude(r, id);
    else this.codex(r, id);
  }
  private message(id: string, role: "user" | "assistant", content: unknown): void {
    const entry = this.contribution(id);
    const countKey = role === "user" ? "userMessages" : "assistantMessages";
    const charactersKey = role === "user" ? "userCharacters" : "assistantCharacters";
    if (this.provider === "codex" && entry.metrics[countKey] === null) {
      const signature = `${this.day}:${role}:${hash(messageText(content))}`;
      if (id.startsWith("fallback:")) this.fallbackMessages.set(id, signature);
      else this.directMessages.set(signature, (this.directMessages.get(signature) ?? 0) + 1);
    }
    entry.metrics[countKey] = 1;
    entry.metrics[charactersKey] = Math.max(entry.metrics[charactersKey] ?? 0, textLength(content));
  }
  private call(id: string, name: string, input: unknown): void {
    const entry = this.contribution(`call:${id}`);
    if (entry.metrics.toolCalls !== null) return;
    entry.metrics.toolCalls = 1;
    entry.metrics.toolInputCharacters = serializedLength(input);
    entry.tools[name || "unknown"] = 1;
  }
  private output(id: string, output: unknown, error: boolean): void {
    const entry = this.contribution(`output:${id}`);
    if (entry.metrics.toolOutputCharacters !== null) return;
    entry.metrics.toolOutputCharacters = serializedLength(output);
    entry.metrics.toolErrors = Number(error);
  }
  private claude(r: RecordValue, id: string): void {
    this.result.nativeId ||= string(r.sessionId);
    this.result.cwd ||= string(r.cwd);
    this.result.branch = string(r.gitBranch) || this.result.branch;
    if (r.type === "ai-title") this.result.title = string(r.aiTitle).slice(0, 300);
    const m = object(r.message);
    const model = string(m.model);
    if (model && model !== "<synthetic>") this.model = model;
    if (r.type === "assistant" && model !== "<synthetic>") {
      this.effort = recordedEffort(r.effort);
      const messageId = string(m.id) || id;
      const usage = normalizeUsage("claude", object(m.usage));
      const entry = this.contribution(`usage:${messageId}`);
      if (this.effort !== null) entry.effort = this.effort;
      // Claude can emit several blocks carrying the same message's usage, then a final update.
      for (const key of TOKEN_KEYS) if (usage[key] !== null) entry.metrics[key] = Math.max(entry.metrics[key] ?? 0, usage[key]!);
      entry.metrics.requests = usage.inputTokens === null ? null : 1;
      entry.metrics.assistantMessages = 1;
      const parts = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }];
      for (let i = 0; i < parts.length; i++) {
        const part = object(parts[i]);
        const block = `block:${messageId}:${r.apiBlockIndex ?? i}`;
        if (part.type === "text") {
          const textBlock = this.contribution(block);
          textBlock.metrics.assistantCharacters = Math.max(textBlock.metrics.assistantCharacters ?? 0, textLength(part.text));
        }
        if (part.type === "tool_use" || part.type === "server_tool_use") this.call(string(part.id) || block, string(part.name), part.input);
      }
    }
    if (r.type === "user") {
      const parts = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }];
      const spoken = parts.filter((part) => ["text", "image"].includes(string(object(part).type)));
      if (spoken.length) this.message(`message:${id}`, "user", spoken);
      for (const part of parts) {
        const p = object(part);
        if (p.type === "tool_result") this.output(string(p.tool_use_id) || id, p.content, p.is_error === true);
      }
    }
    if (r.type === "system" && r.subtype === "compact_boundary") this.add(id, "compactions", 1);
    if (r.type === "system" && r.subtype === "turn_duration" && number(r.durationMs) !== null) this.add(id, "activeMs", number(r.durationMs)!);
    if (r.type === "result") {
      const cost = number(r.total_cost_usd ?? r.cost_usd);
      if (cost !== null) this.add(id, "reportedCostUsd", cost);
    }
  }
  private codex(r: RecordValue, id: string): void {
    const p = object(r.payload);
    if (r.type === "session_meta" && !this.result.nativeId) {
      this.result.nativeId = string(p.id) || string(p.session_id);
      this.result.cwd = string(p.cwd);
      const subagent = object(object(p.source).subagent);
      this.result.isSubagent = object(p.source).subagent !== undefined;
      this.result.parentId = string(p.forked_from_id) || string(subagent.parent_thread_id) || string(object(subagent.thread_spawn).parent_thread_id) || null;
      this.result.branch = string(object(p.git).branch);
      this.rememberTime(timestamp(p.timestamp));
    }
    if (r.type === "turn_context") {
      this.model = string(p.model) || this.model;
      this.effort = recordedEffort(p.effort);
    }
    if (r.type === "event_msg" && p.type === "thread_settings_applied") {
      const settings = object(p.thread_settings);
      this.model = string(settings.model) || this.model;
      this.effort = recordedEffort(settings.reasoning_effort);
    }
    if (r.type === "token_usage_record") {
      if (this.result.nativeId && string(p.thread_id) && p.thread_id !== this.result.nativeId) {
        this.warn("Inherited token records from another thread were excluded.");
        return;
      }
      const response = string(p.response_id) || id;
      const usage = normalizeUsage("codex", object(p.usage));
      if (usage.inputTokens === null && usage.outputTokens === null) return;
      // Modern thread counters include compaction usage; legacy token_count counters can
      // reset per context window. They are different series and must never be subtracted.
      if (!this.hasDirectUsage && this.lastLegacy?.time === string(r.timestamp) && hash(this.lastLegacy.usage) === hash(usage)) this.contributions.delete(this.lastLegacy.id);
      this.hasDirectUsage = true;
      if (!this.responseIds.has(response)) {
        this.responseIds.add(response);
        const entry = this.contribution(`usage:${response}`);
        entry.metrics = usage;
        entry.metrics.requests = 1;
      }
    }
    if (r.type === "event_msg" && p.type === "token_count" && !this.hasDirectUsage) {
      const info = object(p.info);
      const total = normalizeUsage("codex", object(info.total_token_usage));
      if (total.inputTokens !== null) {
        const previous = this.totalUsage;
        const delta = emptyMetrics();
        const reset = previous !== null && ((total.inputTokens ?? 0) < (previous.inputTokens ?? 0) || (total.outputTokens ?? 0) < (previous.outputTokens ?? 0));
        for (const key of TOKEN_KEYS) if (total[key] !== null) delta[key] = Math.max(0, total[key]! - (reset ? 0 : previous?.[key] ?? 0));
        if ((delta.inputTokens ?? 0) + (delta.outputTokens ?? 0) > 0) {
          if (reset) this.warn("Usage counter reset; counted the new counter segment separately.");
          const key = `legacy-usage:${this.legacyIndex++}`;
          const entry = this.contribution(key);
          entry.metrics = delta;
          entry.metrics.requests = 1;
          this.lastLegacy = { id: key, time: string(r.timestamp), usage: normalizeUsage("codex", object(info.last_token_usage)) };
        }
        this.totalUsage = total;
      }
    }
    if (r.type === "response_item") {
      if (p.type === "message" && (p.role === "user" || p.role === "assistant")) {
        this.message(`message:${string(p.id) || id}`, p.role, p.content);
      }
      if (p.type === "function_call" || p.type === "custom_tool_call" || p.type === "web_search_call") this.call(string(p.call_id) || string(p.id) || id, string(p.name) || string(p.type), p.arguments ?? p.input ?? p.action);
      if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
        const out = object(p.output);
        // Only explicit status/exit codes; arbitrary occurrences of "error" are not failures.
        const output = string(p.output);
        const exit = /(?:Process exited with code|exit code|\"exit_code\"\s*:)\s*(-?\d+)/i.exec(output);
        this.output(string(p.call_id) || id, p.output, out.is_error === true || out.isError === true || (typeof out.exit_code === "number" && Number.isFinite(out.exit_code) && out.exit_code !== 0) || (exit !== null && Number(exit[1]) !== 0));
      }
    }
    if (r.type === "event_msg") {
      if (p.type === "user_message" || p.type === "agent_message") this.message(`fallback:${p.type === "user_message" ? "user" : "assistant"}:${id}`, p.type === "user_message" ? "user" : "assistant", p.message);
      if (p.type === "item_completed") {
        const item = object(p.item);
        const kind = string(item.type);
        if (["CommandExecution", "McpToolCall", "FileChange", "WebSearch"].includes(kind)) {
          const key = `execution:${string(item.id) || id}`;
          if (!this.contributions.has(key)) {
            this.add(key, "toolExecutions", 1);
            this.add(key, "executionErrors", Number(item.status === "failed" || (typeof item.exit_code === "number" && item.exit_code !== 0) || object(item.result).isError === true));
          }
        }
      }
      if (p.type === "task_started") this.turnStartedAt = timestamp(p.started_at) ?? timestamp(r.timestamp);
      if (p.type === "task_complete" || p.type === "turn_aborted") {
        const started = timestamp(p.started_at) ?? this.turnStartedAt;
        const completed = timestamp(p.completed_at) ?? timestamp(r.timestamp);
        const duration = number(p.duration_ms) ?? (started && completed ? Math.max(0, Date.parse(completed) - Date.parse(started)) : null);
        if (duration !== null) {
          const entry = this.contribution(`turn:${string(p.turn_id) || id}`);
          entry.metrics.activeMs = Math.max(entry.metrics.activeMs ?? 0, duration);
        }
        this.turnStartedAt = null;
      }
    }
    if (r.type === "compacted") this.add(id, "compactions", 1);
  }
  finish(): ParsedTranscript {
    const buckets = new Map<string, Bucket>();
    const directMessages = new Map(this.directMessages);
    for (const [id, entry] of this.contributions) {
      const signature = this.fallbackMessages.get(id);
      if (signature && (directMessages.get(signature) ?? 0) > 0) {
        directMessages.set(signature, directMessages.get(signature)! - 1);
        continue;
      }
      if (id.startsWith("usage:") || id.startsWith("legacy-usage:")) entry.metrics.estimatedCostUsd = estimateCost(entry.model, entry.metrics);
      const key = JSON.stringify([entry.day, entry.model, entry.effort]);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { day: entry.day, model: entry.model, effort: entry.effort, metrics: emptyMetrics(), tools: Object.create(null) as Record<string, number> };
        // Absence of a recorded event is a known zero only for a readable transcript.
        for (const metric of COUNT_KEYS) bucket.metrics[metric] = 0;
        buckets.set(key, bucket);
      }
      addMetrics(bucket.metrics, entry.metrics);
      for (const [tool, count] of Object.entries(entry.tools)) bucket.tools[tool] = (bucket.tools[tool] ?? 0) + count;
    }
    if (!this.validRecords) this.warn("No readable transcript records.");
    if (![...buckets.values()].some((bucket) => bucket.metrics.inputTokens !== null)) this.warn("No token usage records found; token and cost measurements are unknown.");
    this.result.buckets = [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day) || a.model.localeCompare(b.model) || (a.effort ?? "").localeCompare(b.effort ?? ""));
    this.result.warnings = [...this.warnings];
    return this.result;
  }
}

/** Bound memory for tool results that occupy a multi-megabyte JSONL line. */
export const MAX_LINE_BYTES = 16 * 1024 * 1024;
export async function parseTranscript(path: string, provider: "claude" | "codex", signal?: AbortSignal): Promise<ParsedTranscript> {
  const parser = new TranscriptParser(provider);
  const stream = createReadStream(path, { highWaterMark: 64 * 1024, signal });
  let chunks: Buffer[] = [];
  let length = 0;
  let skipping = false;
  function consume(part: Buffer, end: boolean) {
    if (!skipping) {
      length += part.length;
      if (length > MAX_LINE_BYTES) { skipping = true; chunks = []; parser.warn("Skipped records larger than 16 MiB; statistics are partial."); }
      else chunks.push(part);
    }
    if (end) {
      if (!skipping && length) {
        try { parser.accept(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch { parser.warn("Skipped malformed or unfinished JSONL records; statistics are partial."); }
      }
      chunks = []; length = 0; skipping = false;
    }
  }
  for await (const chunk of stream) {
    const buffer = chunk as Buffer;
    let start = 0;
    for (let i = 0; i < buffer.length; i++) if (buffer[i] === 10) { consume(buffer.subarray(start, i), true); start = i + 1; }
    if (start < buffer.length) consume(buffer.subarray(start), false);
  }
  consume(Buffer.alloc(0), true);
  return parser.finish();
}
