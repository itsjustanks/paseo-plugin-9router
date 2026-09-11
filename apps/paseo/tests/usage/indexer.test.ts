/**
 * Adapted from panrafal/paseo-plugins `session-usage/server/indexer.test.ts`
 * (commit 8d33de5, https://github.com/panrafal/paseo-plugins), MIT License,
 * Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the repository root.
 *
 * Run through tests/usage.mjs, which transpiles for Node 20.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, appendFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { UsageIndex, transcriptProvider } from "../../server/transcript-index";
import { SnapshotSchema } from "../../shared/usage-schema";
import { EMPTY_FILTERS, filterSessions } from "../../shared/usage-model";

test("index joins archived metadata, deduplicates copies, keeps missing agents and refreshes changed files", async () => {
  const root = await mkdtemp(join(tmpdir(), "9router-usage-index-"));
  const roots = { paseo: join(root, "paseo"), claude: join(root, "claude"), codex: join(root, "codex") };
  const index = new UsageIndex(roots);
  async function save(path: string, content: string) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, content); }
  try {
    await save(join(roots.paseo, "projects", "projects.json"), JSON.stringify([{ projectId: "p", rootPath: "/project", customName: "Project", archivedAt: "2026-09-01" }]));
    await save(join(roots.paseo, "projects", "workspaces.json"), JSON.stringify([{ workspaceId: "w", projectId: "p", cwd: "/worktree", title: "Workspace", labels: ["team"] }]));
    const agent = { id: "a", provider: "claude", cwd: "/worktree", workspaceId: "w", title: "Agent", createdAt: "2026-09-01", persistence: { sessionId: "c1", metadata: { apiKey: "SECRET_MUST_NOT_LEAK" } } };
    const agentPath = join(roots.paseo, "agents", "bucket", "a.json");
    await save(agentPath, JSON.stringify(agent));
    await save(join(roots.paseo, "agents", "bucket", "resumed.json"), JSON.stringify({ ...agent, id: "resumed", archivedAt: "2026-09-01" }));
    await save(join(roots.paseo, "agents", "bucket", "missing.json"), JSON.stringify({ ...agent, id: "missing", persistence: { sessionId: "missing-session" } }));
    const claudePath = join(roots.claude, "projects", "-worktree", "c1.jsonl");
    const claude = (id: string) => JSON.stringify({ type: "assistant", uuid: id, timestamp: "2026-09-01T12:00:00Z", sessionId: "c1", cwd: "/worktree", message: { id, model: "claude-opus-4-6", content: [{ type: "text", text: "PRIVATE_TRANSCRIPT_TEXT" }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20, cache_creation_input_tokens: 30 } } }) + "\n";
    await save(claudePath, claude("r1"));
    await save(join(roots.claude, "projects", "-worktree", "c1", "subagents", "agent-child.jsonl"), claude("r2"));
    const filename = "rollout-2026-09-01T12-00-00-x1.jsonl";
    const codex = JSON.stringify({ type: "session_meta", timestamp: "2026-09-01T12:00:00Z", payload: { id: "x1", cwd: "/outside" } }) + "\n" + JSON.stringify({ type: "token_usage_record", timestamp: "2026-09-01T12:00:01Z", payload: { response_id: "r1", usage: { input_tokens: 100, output_tokens: 20, cached_input_tokens: 50 } } }) + "\n";
    await save(join(roots.codex, "sessions", filename), codex);
    await save(join(roots.codex, "archived_sessions", filename), codex);
    assert.equal(index.snapshot().scanning, true);
    const snapshot = await index.settled();
    SnapshotSchema.parse(snapshot);
    assert.equal(snapshot.sessions.length, 4);
    assert.ok(snapshot.checkedAt, "a completed scan records checkedAt");
    assert.ok(snapshot.scanMs !== null && snapshot.scanMs >= 0);
    assert.ok(snapshot.scannedBytes > 0);
    const main = snapshot.sessions.find((s) => s.id === "claude:c1")!;
    assert.equal(main.agentId, "a");
    assert.equal(main.agentProvider, "claude");
    assert.equal(main.archived, true);
    assert.equal(main.project, "Project");
    assert.deepEqual(main.labels, ["team"]);
    const child = snapshot.sessions.find((s) => s.kind === "subagent")!;
    assert.equal(child.parentId, main.id);
    assert.equal(child.projectId, "p");
    assert.equal(child.agentId, null);
    assert.equal(snapshot.sessions.find((s) => s.provider === "codex")!.archived, true);
    assert.equal(snapshot.sessions.find((s) => s.nativeId === "missing-session")!.coverage, "missing");
    assert.ok(!JSON.stringify(snapshot).includes("SECRET_MUST_NOT_LEAK"));
    assert.ok(!JSON.stringify(snapshot).includes("PRIVATE_TRANSCRIPT_TEXT"));
    const originalMetadata = await readFile(agentPath, "utf8");
    await appendFile(claudePath, claude("r3"));
    index.snapshot(true);
    const refreshed = await index.settled();
    const mainRow = filterSessions(refreshed.sessions, EMPTY_FILTERS).find((r) => r.session.id === main.id)!;
    assert.equal(mainRow.metrics.inputTokens, 120);
    assert.equal(await readFile(agentPath, "utf8"), originalMetadata);
    await rm(claudePath);
    index.snapshot(true);
    const removed = await index.settled();
    assert.equal(removed.sessions.find((s) => s.id === main.id)!.coverage, "missing");
  } finally { index.dispose(); await rm(root, { recursive: true, force: true }); }
});

test("unavailable provider directories produce an empty completed scan without mutating the host", async () => {
  const root = await mkdtemp(join(tmpdir(), "9router-usage-empty-"));
  const index = new UsageIndex({ paseo: join(root, "paseo"), claude: join(root, "claude"), codex: join(root, "codex") });
  try {
    index.snapshot();
    const snapshot = await index.settled();
    assert.deepEqual(snapshot.sessions, []);
    assert.equal(snapshot.scanning, false);
    assert.deepEqual(snapshot.warnings, []);
  } finally { index.dispose(); await rm(root, { recursive: true, force: true }); }
});

// 9Router additions.
test("Paseo providers map to the transcript tree their sessions live in", () => {
  assert.equal(transcriptProvider("claude"), "claude");
  assert.equal(transcriptProvider("ninerouter"), "claude", "a routed session is a Claude Code process pointed at 9router");
  assert.equal(transcriptProvider("claude-auto"), "claude");
  assert.equal(transcriptProvider("codex"), "codex");
  assert.equal(transcriptProvider("codex-auto"), "codex");
  assert.equal(transcriptProvider("kimi"), null);
  assert.equal(transcriptProvider("cursor"), null);
});

test("a ninerouter agent is joined to its Claude transcript and the snapshot says so", async () => {
  const root = await mkdtemp(join(tmpdir(), "9router-usage-routed-"));
  const roots = { paseo: join(root, "paseo"), claude: join(root, "claude"), codex: join(root, "codex") };
  const index = new UsageIndex(roots);
  async function save(path: string, content: string) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, content); }
  try {
    await save(join(roots.paseo, "agents", "b", "routed.json"), JSON.stringify({ id: "routed", provider: "ninerouter", cwd: "/w", workspaceId: "w", title: "Routed", createdAt: "2026-09-01", persistence: { sessionId: "r1", nativeHandle: "r1", metadata: { mcpServers: { paseo: { headers: { Authorization: "Bearer TOKEN_MUST_NOT_LEAK" } } } } } }));
    await save(join(roots.paseo, "agents", "b", "kimi.json"), JSON.stringify({ id: "kimi", provider: "kimi", cwd: "/w", workspaceId: "w", title: "Kimi", createdAt: "2026-09-01", persistence: { sessionId: "k1" } }));
    await save(join(roots.claude, "projects", "-w", "r1.jsonl"), JSON.stringify({ type: "assistant", uuid: "a", timestamp: "2026-09-01T12:00:00Z", sessionId: "r1", cwd: "/w", message: { id: "m", model: "cc/claude-opus-5", content: [], usage: { input_tokens: 1_000_000, output_tokens: 0 } } }) + "\n");
    index.snapshot();
    const snapshot = await index.settled();
    assert.equal(snapshot.sessions.length, 1, "the kimi agent has no transcript this index reads and adds no row");
    const routed = snapshot.sessions[0];
    assert.equal(routed.agentId, "routed");
    assert.equal(routed.agentProvider, "ninerouter");
    assert.equal(routed.buckets[0].metrics.estimatedCostUsd, 5);
    assert.ok(!JSON.stringify(snapshot).includes("TOKEN_MUST_NOT_LEAK"));
    // A second read inside the stale window is the cache, not a scan.
    assert.equal(index.snapshot().scanning, false);
  } finally { index.dispose(); await rm(root, { recursive: true, force: true }); }
});
