/**
 * Adapted from panrafal/paseo-plugins `session-usage/server/parser.test.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * Run through tests/usage.mjs, which transpiles for Node 20.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addMetrics, emptyMetrics } from "../../shared/usage-schema";
import { estimateCost, pricedModel } from "../../shared/usage-pricing";
import { normalizeUsage, parseTranscript, TranscriptParser, MAX_LINE_BYTES } from "../../server/transcript-parser";

const date = "2026-09-01T12:00:00.000Z";
const usage = (input: number, cached = 0, output = 20, write = 0) => ({ input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: write, output_tokens: output, reasoning_output_tokens: 5, total_tokens: input + output });
function parse(provider: "claude" | "codex", records: unknown[]) {
  const parser = new TranscriptParser(provider);
  for (const record of records) parser.accept(record);
  const result = parser.finish();
  return { ...result, metrics: result.buckets.reduce((m, b) => addMetrics(m, b.metrics), emptyMetrics()) };
}
const codex = (type: string, payload: unknown, timestamp = date) => ({ type, timestamp, payload });
const token = (u: unknown, timestamp = date) => codex("event_msg", { type: "token_count", info: { total_token_usage: u, last_token_usage: u } }, timestamp);

test("Claude records effort per message without carrying it into messages that omit it", () => {
  const assistant = (id: string, effort?: unknown, output = 20) => ({
    type: "assistant", uuid: `${id}-${output}`, timestamp: date, effort,
    message: { id, model: "claude-opus-4-6", usage: { input_tokens: 100, output_tokens: output }, content: [] },
  });
  const result = parse("claude", [assistant("a", "high"), assistant("a", "high", 30), assistant("b", "medium"), assistant("c"), assistant("d", { invalid: true })]);
  assert.deepEqual(result.buckets.map((b) => [b.effort, b.metrics.inputTokens, b.metrics.outputTokens]), [
    [null, 200, 40], ["high", 100, 30], ["medium", 100, 20],
  ]);
  assert.equal(result.metrics.requests, 4);
  assert.equal(result.metrics.inputTokens, 400);
});

test("Codex preserves effort changes, applied settings, explicit none, and unrecorded turns", () => {
  const response = (id: string) => codex("token_usage_record", { response_id: id, usage: usage(100) });
  const result = parse("codex", [
    codex("turn_context", { model: "gpt-5.6-sol", effort: "low" }), response("a"),
    codex("turn_context", { model: "gpt-5.6-sol", effort: "xhigh" }), response("b"), response("b"),
    codex("event_msg", { type: "thread_settings_applied", thread_settings: { model: "gpt-5.6-sol", reasoning_effort: "medium" } }), response("c"),
    codex("turn_context", { model: "gpt-5.6-sol", effort: "none" }), response("d"),
    codex("turn_context", { model: "gpt-5.6-sol" }), response("e"),
  ]);
  assert.deepEqual(result.buckets.map((b) => b.effort), [null, "low", "medium", "none", "xhigh"]);
  assert.equal(result.metrics.inputTokens, 500);
  assert.equal(result.metrics.requests, 5);
  const legacy = parse("codex", [
    codex("turn_context", { model: "gpt-5.6-sol", effort: "low" }), token(usage(100)),
    codex("turn_context", { model: "gpt-5.6-sol", effort: "high" }), token(usage(300, 0, 40)),
  ]);
  assert.deepEqual(legacy.buckets.map((b) => [b.effort, b.metrics.inputTokens]), [["high", 200], ["low", 100]]);
});

test("Claude merges message usage snapshots and counts cache writes only once", () => {
  const message = { id: "m1", model: "claude-opus-4-6", role: "assistant", usage: { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 50, output_tokens: 5, cache_creation: { ephemeral_1h_input_tokens: 20 }, output_tokens_details: { thinking_tokens: 2 } } };
  const records = [
    { type: "user", uuid: "u", timestamp: date, sessionId: "s", cwd: "/test", message: { content: "Hello 🌍" } },
    { type: "assistant", uuid: "a", apiBlockIndex: 0, timestamp: date, message: { ...message, content: [{ type: "text", text: "Hi!" }] } },
    { type: "assistant", uuid: "b", apiBlockIndex: 1, timestamp: date, message: { ...message, usage: { ...message.usage, output_tokens: 15 }, content: [{ type: "tool_use", id: "t", name: "Bash", input: { command: "false" } }] } },
    { type: "user", uuid: "r", timestamp: date, message: { content: [{ type: "tool_result", tool_use_id: "t", content: "Failed", is_error: true }] } },
  ];
  const result = parse("claude", [...records, records[1], records[2]]);
  assert.equal(result.metrics.inputTokens, 160);
  assert.equal(result.metrics.uncachedTokens, 10);
  assert.equal(result.metrics.cacheReadTokens, 100);
  assert.equal(result.metrics.cacheWriteTokens, 50);
  assert.equal(result.metrics.outputTokens, 15);
  assert.equal(result.metrics.reasoningTokens, 2);
  assert.equal(result.metrics.requests, 1);
  assert.equal(result.metrics.assistantMessages, 1);
  assert.equal(result.metrics.userMessages, 1);
  assert.equal(result.metrics.userCharacters, 7);
  assert.equal(result.metrics.toolCalls, 1);
  assert.equal(result.metrics.toolErrors, 1);
  assert.equal(result.metrics.estimatedCostUsd, (10 * 5 + 100 * 0.5 + 30 * 6.25 + 20 * 10 + 15 * 25) / 1e6);
  assert.equal(result.metrics.reportedCostUsd, null);
});

test("Codex prefers per-response usage when legacy counters reset after compaction", () => {
  const records = [
    codex("turn_context", { model: "gpt-6-astra" }),
    codex("token_usage_record", { response_id: "r1", usage: usage(100, 50), thread_token_usage: usage(100, 50) }),
    token(usage(100, 50)),
    codex("compacted", { message: "not retained" }),
    codex("token_usage_record", { response_id: "r2", usage: usage(200, 80, 30, 20), thread_token_usage: usage(300, 130, 50, 20) }),
    token(usage(150, 80, 30, 20)),
    token(usage(150, 80, 30, 20), "2026-09-01T12:00:01Z"),
    codex("token_usage_record", { response_id: "r2", usage: usage(200, 80, 30, 20) }, "2026-09-01T12:00:02Z"),
  ];
  const result = parse("codex", records);
  assert.equal(result.metrics.inputTokens, 300);
  assert.equal(result.metrics.uncachedTokens, 150);
  assert.equal(result.metrics.cacheReadTokens, 130);
  assert.equal(result.metrics.cacheWriteTokens, 20);
  assert.equal(result.metrics.outputTokens, 50);
  assert.equal(result.metrics.requests, 2);
  assert.equal(result.metrics.compactions, 1);
  assert.deepEqual(result.warnings, []);
});

test("legacy Codex counters use increments, ignore repeated totals, and preserve reset segments", () => {
  const result = parse("codex", [
    codex("turn_context", { model: "old-model" }),
    token(usage(100, 50)), token(usage(100, 50), "2026-09-01T12:01:00Z"),
    token(usage(300, 250, 40), "2026-09-02T12:00:00Z"),
    token(usage(50, 10, 10), "2026-09-03T12:00:00Z"),
  ]);
  assert.equal(result.metrics.inputTokens, 350);
  assert.equal(result.metrics.outputTokens, 50);
  assert.equal(result.metrics.cacheReadTokens, 260);
  assert.equal(result.metrics.requests, 3);
  assert.equal(result.buckets[1].metrics.inputTokens, 200);
  assert.equal(result.metrics.estimatedCostUsd, null);
  assert.match(result.warnings.join(" "), /counter reset/);
});

test("transition from legacy counters to response records does not double count a mirrored event", () => {
  const u = usage(100, 40);
  const result = parse("codex", [token(u), codex("token_usage_record", { response_id: "r", usage: u }), token(u)]);
  assert.equal(result.metrics.inputTokens, 100);
  assert.equal(result.metrics.requests, 1);
});

test("the first Codex metadata record identifies subagents even with embedded parent metadata", () => {
  const result = parse("codex", [
    codex("session_meta", { id: "child", cwd: "/child", source: { subagent: { thread_spawn: { parent_thread_id: "parent" } } } }),
    codex("session_meta", { id: "parent", cwd: "/parent", source: "vscode" }),
    codex("token_usage_record", { thread_id: "parent", response_id: "old", usage: usage(9999) }),
    codex("token_usage_record", { thread_id: "child", response_id: "new", usage: usage(100) }),
  ]);
  assert.equal(result.nativeId, "child");
  assert.equal(result.parentId, "parent");
  assert.equal(result.cwd, "/child");
  assert.equal(result.isSubagent, true);
  assert.equal(result.metrics.inputTokens, 100);
});

test("Codex counts canonical messages, model calls, executions and explicit failures separately", () => {
  const result = parse("codex", [
    codex("response_item", { type: "message", id: "u1", role: "user", content: [{ type: "input_text", text: "Hello" }] }),
    codex("event_msg", { type: "user_message", message: "Hello" }),
    codex("event_msg", { type: "item_completed", item: { type: "UserMessage", id: "u1", content: [{ text: "Hello" }] } }),
    codex("response_item", { type: "custom_tool_call", call_id: "call1", name: "exec", input: "run()" }),
    codex("event_msg", { type: "item_completed", item: { type: "CommandExecution", id: "exec1", status: "failed", exit_code: 1 } }),
    codex("event_msg", { type: "item_completed", item: { type: "CommandExecution", id: "exec2", status: "completed", exit_code: 0 } }),
    codex("response_item", { type: "custom_tool_call_output", call_id: "call1", output: "Process exited with code 1" }),
    codex("response_item", { type: "function_call", call_id: "call2", name: "read", arguments: "{}" }),
    codex("response_item", { type: "function_call_output", call_id: "call2", output: "Found the word error in a document" }),
  ]);
  assert.equal(result.metrics.userMessages, 1);
  assert.equal(result.metrics.userCharacters, 5);
  assert.equal(result.metrics.toolCalls, 2);
  assert.equal(result.metrics.toolErrors, 1);
  assert.equal(result.metrics.toolExecutions, 2);
  assert.equal(result.metrics.executionErrors, 1);
});

test("tokens remain unknown without usage, and reported turn times preserve calendar placement", () => {
  const result = parse("codex", [codex("event_msg", { type: "task_started", turn_id: "t" }), codex("event_msg", { type: "task_complete", turn_id: "t", duration_ms: 60_000 }, "2026-09-02T00:00:00Z")]);
  assert.equal(result.metrics.inputTokens, null);
  assert.equal(result.metrics.activeMs, 60_000);
  assert.equal(result.startedAt, date);
  assert.equal(result.buckets[0].day, "2026-09-02");
});

test("negative/nonfinite usage is rejected and reasoning is not added to output", () => {
  const value = normalizeUsage("codex", { ...usage(100, 50), output_tokens: Infinity, reasoning_output_tokens: -1 });
  assert.equal(value.outputTokens, null);
  assert.equal(value.reasoningTokens, null);
  assert.equal(value.inputTokens, 100);
});

test("message updates do not multiply characters and mixed Codex history keeps unmatched fallback messages", () => {
  const result = parse("codex", [
    codex("event_msg", { type: "user_message", message: "Older message" }, "2026-08-01T12:00:00Z"),
    codex("response_item", { type: "message", id: "m", role: "assistant", content: [{ type: "output_text", text: "Hello" }] }),
    codex("response_item", { type: "message", id: "m", role: "assistant", content: [{ type: "output_text", text: "Hello there" }] }, "2026-09-01T12:00:01Z"),
  ]);
  assert.equal(result.metrics.userMessages, 1);
  assert.equal(result.metrics.assistantMessages, 1);
  assert.equal(result.metrics.assistantCharacters, 11);
  const claude = parse("claude", [
    { type: "assistant", uuid: "a", apiBlockIndex: 0, timestamp: date, message: { id: "m", model: "claude-opus-5", content: [{ type: "text", text: "Hello" }] } },
    { type: "assistant", uuid: "b", apiBlockIndex: 0, timestamp: date, message: { id: "m", model: "claude-opus-5", content: [{ type: "text", text: "Hello there" }] } },
  ]);
  assert.equal(claude.metrics.assistantCharacters, 11);
});

test("streaming parser tolerates a partial tail and bounds oversized records", async () => {
  const root = await mkdtemp(join(tmpdir(), "9router-usage-parser-"));
  try {
    const path = join(root, "session.jsonl");
    await writeFile(path, `${JSON.stringify(codex("token_usage_record", { response_id: "r", usage: usage(100, 50) }))}\n${"x".repeat(MAX_LINE_BYTES + 1)}\n{"unfinished":`);
    const result = await parseTranscript(path, "codex");
    assert.equal(result.buckets[0].metrics.inputTokens, 100);
    assert.equal(result.warnings.length, 2);
    assert.ok(!JSON.stringify(result).includes('"unfinished":'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

// 9Router additions: routed sessions record 9router's alias as the model name.
test("a 9router alias prices as its base model; unknown prefixes and models stay unpriced", () => {
  assert.equal(pricedModel("cc/claude-opus-5"), "claude-opus-5");
  assert.equal(pricedModel("claude-opus-4-6-20260201"), "claude-opus-4-6");
  assert.equal(pricedModel("cx/gpt-6-astra"), "gpt-6-astra");
  const metrics = { ...emptyMetrics(), uncachedTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
  assert.equal(estimateCost("cc/claude-opus-5", metrics), 5);
  assert.equal(estimateCost("claude-opus-5", metrics), 5);
  assert.equal(estimateCost("cc/made-up-model", metrics), null);
  const result = parse("claude", [{ type: "assistant", uuid: "a", timestamp: date, message: { id: "m", model: "cc/claude-sonnet-5", usage: { input_tokens: 1_000_000, output_tokens: 0 }, content: [] } }]);
  assert.equal(result.metrics.estimatedCostUsd, 2);
});
