/**
 * Adapted from panrafal/paseo-plugins `session-usage/server/indexer.ts` and
 * `server/paseo-home.ts` (commit 8d33de5, https://github.com/panrafal/paseo-plugins),
 * MIT License, Copyright (c) 2026 panrafal. See THIRD-PARTY-NOTICES.md at the
 * repository root.
 *
 * 9Router changes: agents are joined by their provider session id whatever
 * Paseo provider opened them (`ninerouter`, `claude-auto`, `codex-auto`, … as
 * well as `claude` and `codex`), the snapshot carries `checkedAt`, scan wall
 * time and bytes covered, and the index is a module singleton with a
 * background poller in the style of `server/health.ts`.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { object, string, parseTranscript, type ParsedTranscript } from "./transcript-parser";
import { addMetrics, emptyMetrics, type Metrics, type Session, type Snapshot } from "../shared/usage-schema";
import type { AgentUsage, TranscriptUsage } from "../shared/contracts";

type Provider = "claude" | "codex";
interface Source {
  path: string;
  provider: Provider;
  nativeId: string;
  parentId: string | null;
  kind: "main" | "subagent";
  archived: boolean;
  size: number;
  mtimeMs: number;
}
interface Metadata {
  agents: Map<string, Agent>;
  workspaces: Map<string, Workspace>;
  projects: Map<string, Project>;
}
interface Agent { id: string; nativeId: string; provider: Provider; paseoProvider: string; workspaceId: string; cwd: string; title: string; archived: boolean; status: string; createdAt: string; model: string }
interface Workspace { id: string; projectId: string; cwd: string; title: string; branch: string; labels: string[]; archived: boolean }
interface Project { id: string; root: string; name: string; archived: boolean }
export interface Roots { paseo: string; claude: string; codex: string }

export function paseoHome(): string {
  const raw = process.env.PASEO_HOME ?? "~/.paseo";
  if (raw === "~") return homedir();
  return resolve(raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw);
}

/**
 * Which transcript tree a Paseo provider's sessions live in. Routed sessions
 * (`ninerouter`, `agent-link`) are Claude Code processes pointed at 9router, so
 * their transcripts are Claude transcripts; `*-auto` and vendor-prefixed ids
 * follow their family. Anything else (kimi, grok, cursor, …) has no transcript
 * this index reads and is left out.
 */
export function transcriptProvider(paseoProvider: string): Provider | null {
  const id = paseoProvider.toLowerCase();
  if (id === "codex" || id.startsWith("codex-")) return "codex";
  if (id === "claude" || id.startsWith("claude-") || id === "ninerouter" || id === "agent-link" || id === "agent-router") return "claude";
  return null;
}

async function entries(path: string, warnings: Set<string>) {
  try { return await readdir(path, { withFileTypes: true }); }
  catch (error) {
    // Only the directory's basename: a full path can name a project or a user.
    if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) warnings.add(`Cannot read directory: ${basename(path)}`);
    return [];
  }
}
async function json(path: string, warnings: Set<string>): Promise<unknown> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") warnings.add(`Cannot read metadata: ${basename(path)}`);
    return null;
  }
}
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export async function readMetadata(root: string, warnings: Set<string>): Promise<Metadata> {
  const metadata: Metadata = { agents: new Map(), workspaces: new Map(), projects: new Map() };
  const [projects, workspaces] = await Promise.all([json(join(root, "projects", "projects.json"), warnings), json(join(root, "projects", "workspaces.json"), warnings)]);
  for (const raw of array(projects)) {
    const p = object(raw);
    const id = string(p.projectId);
    if (id) metadata.projects.set(id, { id, root: string(p.rootPath), name: string(p.customName) || string(p.displayName) || basename(string(p.rootPath)), archived: Boolean(p.archivedAt) });
  }
  for (const raw of array(workspaces)) {
    const w = object(raw);
    const id = string(w.workspaceId);
    if (id) metadata.workspaces.set(id, { id, cwd: string(w.cwd), projectId: string(w.projectId), title: string(w.title) || string(w.displayName) || basename(string(w.cwd)), branch: string(w.branch), labels: array(w.labels).filter((label): label is string => typeof label === "string"), archived: Boolean(w.archivedAt) });
  }
  const directories = await entries(join(root, "agents"), warnings);
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const path = join(root, "agents", directory.name);
    for (const file of await entries(path, warnings)) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const a = object(await json(join(path, file.name), warnings));
      const paseoProvider = string(a.provider);
      const provider = transcriptProvider(paseoProvider);
      if (!provider) continue;
      // Explicit allowlist: persistence.metadata contains credentials and is never retained.
      const p = object(a.persistence);
      const nativeId = provider === "claude" ? string(p.sessionId) || string(p.nativeHandle) : string(p.nativeHandle) || string(p.sessionId);
      const id = string(a.id);
      if (!id) continue;
      const key = `${provider}:${nativeId || `missing:${id}`}`;
      const value: Agent = { id, nativeId, provider, paseoProvider, cwd: string(a.cwd), workspaceId: string(a.workspaceId), title: string(a.title), archived: Boolean(a.archivedAt), status: string(a.lastStatus) || "unknown", createdAt: string(a.createdAt), model: string(object(a.runtimeInfo).model) || string(object(a.config).model) };
      // Resuming the same provider session in multiple Paseo records must not multiply usage.
      const previous = metadata.agents.get(key);
      if (!previous || (previous.archived && !value.archived) || (previous.archived === value.archived && value.createdAt > previous.createdAt)) metadata.agents.set(key, value);
    }
  }
  return metadata;
}

async function discover(roots: Roots, warnings: Set<string>, signal: AbortSignal): Promise<Source[]> {
  const sources = new Map<string, Source>();
  for (const [root, provider, archived] of [[join(roots.claude, "projects"), "claude", false], [join(roots.codex, "sessions"), "codex", false], [join(roots.codex, "archived_sessions"), "codex", true]] as const) {
    const queue = [root];
    while (queue.length) {
      if (signal.aborted) throw new Error("Scan cancelled");
      const directory = queue.pop()!;
      for (const entry of await entries(directory, warnings)) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) { queue.push(path); continue; }
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        let nativeId: string;
        let parentId: string | null = null;
        if (provider === "codex") {
          const match = /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/.exec(entry.name);
          if (!match) continue;
          nativeId = match[1];
        } else {
          nativeId = entry.name.slice(0, -6);
          const segments = path.split(sep);
          const subagentIndex = segments.lastIndexOf("subagents");
          if (subagentIndex >= 1) parentId = segments[subagentIndex - 1];
          if (parentId) nativeId = `${parentId}/${nativeId}`;
        }
        try {
          const info = await stat(path);
          const source: Source = { path, nativeId, provider, archived, parentId, kind: parentId ? "subagent" : "main", size: info.size, mtimeMs: info.mtimeMs };
          const key = `${provider}:${nativeId}`;
          const previous = sources.get(key);
          // A copied/moved rollout in both trees is one session. Prefer the fullest copy.
          if (!previous || previous.size < source.size || (previous.size === source.size && source.mtimeMs > previous.mtimeMs)) sources.set(key, source);
          if (previous?.archived) sources.get(key)!.archived = true;
          if (archived) sources.get(key)!.archived = true;
        } catch { warnings.add("A transcript disappeared or could not be inspected during the scan."); }
      }
    }
  }
  return [...sources.values()].sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function joinSession(source: Source, parsed: ParsedTranscript, metadata: Metadata): Session {
  const key = `${source.provider}:${source.nativeId}`;
  const agent = metadata.agents.get(key);
  const parentId = source.parentId ?? parsed.parentId;
  const parent = parentId ? metadata.agents.get(`${source.provider}:${parentId}`) : undefined;
  const owner = agent ?? parent;
  const cwd = parsed.cwd || owner?.cwd || "";
  const workspace = metadata.workspaces.get(owner?.workspaceId ?? "") ?? [...metadata.workspaces.values()].filter((w) => cwd && resolve(w.cwd) === resolve(cwd)).sort((a, b) => Number(a.archived) - Number(b.archived))[0];
  const project = metadata.projects.get(workspace?.projectId ?? "") ?? [...metadata.projects.values()].filter((p) => p.root && cwd && (resolve(cwd) === resolve(p.root) || resolve(cwd).startsWith(`${resolve(p.root)}${sep}`))).sort((a, b) => b.root.length - a.root.length)[0];
  return {
    id: key, nativeId: source.nativeId, provider: source.provider,
    kind: parentId || parsed.isSubagent ? "subagent" : source.kind, parentId: parentId ? `${source.provider}:${parentId}` : null,
    title: agent?.title || parsed.title || `${source.provider === "claude" ? "Claude" : "Codex"} ${source.nativeId.slice(-12)}`,
    agentId: agent?.id ?? null, agentProvider: agent?.paseoProvider ?? null, workspaceId: workspace?.id ?? null, workspace: workspace?.title ?? "",
    projectId: project?.id ?? null, project: project?.name ?? "Outside Paseo / unknown project",
    cwd, branch: workspace?.branch || parsed.branch, labels: workspace?.labels ?? [],
    archived: source.archived || Boolean(owner?.archived || workspace?.archived || project?.archived),
    status: agent?.status ?? "untracked", startedAt: parsed.startedAt, endedAt: parsed.endedAt,
    bytes: source.size, coverage: parsed.warnings.length ? "partial" : "available", warnings: parsed.warnings, buckets: parsed.buckets,
  };
}

const EMPTY: Snapshot = { sessions: [], scanning: false, completed: 0, total: 0, checkedAt: null, scanMs: null, scannedBytes: 0, warnings: [] };

/** One background scan per installation, four streams at once, size/mtime cache in memory only. */
export class UsageIndex {
  private cache = new Map<string, { size: number; mtimeMs: number; parsed: ParsedTranscript }>();
  private state: Snapshot = EMPTY;
  private controller = new AbortController();
  private running: Promise<void> | null = null;
  private lastScan = 0;
  constructor(private roots: Roots = { paseo: paseoHome(), claude: process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), codex: process.env.CODEX_HOME ?? join(homedir(), ".codex") }, private staleMs = 60_000) {}

  /** The cache; starts a scan when asked to refresh or when the last one is older than `staleMs`. Never blocks. */
  snapshot(refresh = false): Snapshot {
    if (!this.controller.signal.aborted && !this.running && (refresh || !this.lastScan || Date.now() - this.lastScan > this.staleMs)) {
      this.state = { ...this.state, scanning: true, completed: 0, total: 0 };
      this.running = this.scan().catch(() => {
        if (!this.controller.signal.aborted) this.state = { ...this.state, warnings: ["Transcript scan failed. Refresh to retry."], scanning: false };
      }).finally(() => { this.running = null; this.lastScan = Date.now(); });
    }
    return this.state;
  }
  async settled(): Promise<Snapshot> { await this.running; return this.state; }
  dispose(): void { this.controller.abort(); this.cache.clear(); this.state = EMPTY; }

  private async scan(): Promise<void> {
    const started = Date.now();
    const warnings = new Set<string>();
    const [metadata, sources] = await Promise.all([readMetadata(this.roots.paseo, warnings), discover(this.roots, warnings, this.controller.signal)]);
    this.state = { ...this.state, total: sources.length };
    const sessions: Session[] = [];
    let next = 0;
    const livePaths = new Set(sources.map((s) => s.path));
    const worker = async () => {
      while (next < sources.length) {
        if (this.controller.signal.aborted) throw new Error("Scan cancelled");
        const source = sources[next++];
        try {
          const cached = this.cache.get(source.path);
          const parsed = cached?.size === source.size && cached.mtimeMs === source.mtimeMs ? cached.parsed : await parseTranscript(source.path, source.provider, this.controller.signal);
          this.cache.set(source.path, { size: source.size, mtimeMs: source.mtimeMs, parsed });
          sessions.push(joinSession(source, parsed, metadata));
        } catch {
          if (this.controller.signal.aborted) return;
          const session = joinSession(source, { nativeId: source.nativeId, parentId: source.parentId, cwd: "", title: "", branch: "", startedAt: null, endedAt: null, buckets: [], warnings: ["Transcript could not be read."] }, metadata);
          session.coverage = "missing";
          sessions.push(session);
        }
        this.state = { ...this.state, completed: this.state.completed + 1 };
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, sources.length) }, worker));
    if (this.controller.signal.aborted) throw new Error("Scan cancelled");
    const seen = new Set(sessions.map((s) => s.id));
    for (const [key, agent] of metadata.agents) {
      if (seen.has(key)) continue;
      const source: Source = { nativeId: agent.nativeId || `missing:${agent.id}`, provider: agent.provider, parentId: null, kind: "main", path: "", size: 0, mtimeMs: 0, archived: agent.archived };
      const session = joinSession(source, { nativeId: source.nativeId, parentId: null, cwd: agent.cwd, title: agent.title, branch: "", startedAt: agent.createdAt || null, endedAt: null, buckets: [], warnings: [agent.nativeId ? "Transcript is missing from the provider directories." : "Agent has no recorded provider session."] }, metadata);
      session.coverage = "missing";
      sessions.push(session);
    }
    for (const path of this.cache.keys()) if (!livePaths.has(path)) this.cache.delete(path);
    this.state = {
      sessions: sessions.sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? "")),
      scanning: false, completed: sources.length, total: sources.length,
      checkedAt: new Date().toISOString(), scanMs: Date.now() - started,
      scannedBytes: sources.reduce((sum, source) => sum + source.size, 0),
      warnings: [...warnings],
    };
  }
}

// ------------------------------------------------------------------ singleton

let index: UsageIndex | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The one index the RPC reads; created on first use so a plugin that never opens Usage pays nothing. */
export function usageIndex(): UsageIndex {
  index ??= new UsageIndex();
  return index;
}

/** The last report built, keyed on the snapshot object it came from; a client polling every few seconds must not rebuild it. */
let report: { from: Snapshot; value: TranscriptUsage } | null = null;

/**
 * RPC handler: the cached snapshot, with a scan started when stale or asked
 * for. Never blocks on parsing. Rows whose transcript is missing carry no
 * numbers and are reported as a count; working directories stay on the host.
 */
export function handleRouterTranscriptUsage({ refresh }: { refresh: boolean }): TranscriptUsage {
  const snapshot = usageIndex().snapshot(refresh);
  if (report?.from !== snapshot) {
    const sessions = snapshot.sessions.filter((session) => session.coverage !== "missing").map((session) => ({ ...session, cwd: "" }));
    report = { from: snapshot, value: { ...snapshot, sessions, missingSessions: snapshot.sessions.length - sessions.length } };
  }
  return report.value;
}

/** Totals per key (model or day) across a set of buckets, largest first for models, chronological for days. */
function totalsBy(sessions: Session[], key: "model" | "day"): { key: string; metrics: Metrics }[] {
  const groups = new Map<string, Metrics>();
  for (const session of sessions) for (const bucket of session.buckets) groups.set(bucket[key], addMetrics(groups.get(bucket[key]) ?? emptyMetrics(), bucket.metrics));
  const rows = [...groups].map(([id, metrics]) => ({ key: id, metrics }));
  return key === "day"
    ? rows.sort((a, b) => a.key.localeCompare(b.key))
    : rows.sort((a, b) => ((b.metrics.inputTokens ?? 0) + (b.metrics.outputTokens ?? 0)) - ((a.metrics.inputTokens ?? 0) + (a.metrics.outputTokens ?? 0)));
}

/**
 * RPC handler: one agent's own transcript, plus the subagent transcripts it
 * spawned, summed. This is the figure 9router can never produce — its usage
 * rows carry no session, agent or workspace.
 */
export function handleRouterAgentUsage({ agentId }: { agentId: string }): AgentUsage {
  const snapshot = usageIndex().snapshot(false);
  const base = { scanning: snapshot.scanning, checkedAt: snapshot.checkedAt };
  const main = snapshot.sessions.find((session) => session.agentId === agentId);
  if (!main) return { ...base, found: false, provider: null, coverage: null, warnings: [], startedAt: null, endedAt: null, subagents: 0, metrics: emptyMetrics(), byModel: [], byDay: [] };
  const children = snapshot.sessions.filter((session) => session.parentId === main.id);
  const all = [main, ...children];
  return {
    ...base,
    found: true,
    provider: main.provider,
    coverage: main.coverage,
    warnings: [...new Set(all.flatMap((session) => session.warnings))],
    startedAt: main.startedAt,
    endedAt: all.map((session) => session.endedAt ?? "").sort().at(-1) || null,
    subagents: children.length,
    metrics: all.flatMap((session) => session.buckets).reduce((sum, bucket) => addMetrics(sum, bucket.metrics), emptyMetrics()),
    byModel: totalsBy(all, "model").map(({ key, metrics }) => ({ model: key, metrics })),
    byDay: totalsBy(all, "day").map(({ key, metrics }) => ({ day: key, metrics })),
  };
}

/**
 * Background poller. The first tick waits so plugin startup is not spent
 * reading gigabytes of transcripts; later ticks are cheap because only files
 * whose size or mtime changed are reparsed.
 */
export function startTranscriptIndexPoller(firstDelayMs = 15_000, intervalMs = 5 * 60_000): () => void {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    try { usageIndex().snapshot(true); } catch { /* the index records its own warning */ }
    timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, firstDelayMs);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    index?.dispose();
    index = null;
  };
}
