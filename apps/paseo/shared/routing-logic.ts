/**
 * Pure decisions behind the per-agent routing and backoff hooks. Kept free of
 * imports so the tests can load it without a daemon, a router, or the SDK.
 */

export type RoutingSettingsShape = {
  routeAgents: boolean;
  autoResetBackoff: boolean;
  retryOnRateLimit: boolean;
  maxRetriesPerAgent: number;
  /** Poll 9router's account health in the background (v2). */
  healthChecks: boolean;
  /** Minutes between background checks (v2). */
  healthIntervalMinutes: number;
  /** Show the routing-health pill in agent composers (v2). */
  showComposerPill: boolean;
};

/**
 * Schema history. Every version a document may carry on disk is listed so the
 * server can tell "older than us, fill in the new defaults" from "newer than
 * us, refuse to guess":
 *   1  routeAgents, autoResetBackoff, retryOnRateLimit, maxRetriesPerAgent
 *   2  + healthChecks, healthIntervalMinutes, showComposerPill
 */
export const ROUTING_SETTINGS_VERSION = 2;
export const ROUTING_SETTINGS_KNOWN_VERSIONS: readonly number[] = [1, 2];

export const HEALTH_INTERVAL_MIN_MINUTES = 2;
export const HEALTH_INTERVAL_MAX_MINUTES = 120;

/**
 * An active account whose backoff level reached this is no longer "resting";
 * 9router has given up on it for hours and it still counts as a serving slot.
 * Level 15 with a 429 is the case that left one account carrying the whole pool.
 */
export const STUCK_BACKOFF_LEVEL = 5;

/** The schema's defaults; what an unsaved document means. */
export const ROUTING_DEFAULTS: RoutingSettingsShape = {
  routeAgents: false,
  autoResetBackoff: true,
  retryOnRateLimit: false,
  maxRetriesPerAgent: 1,
  healthChecks: true,
  healthIntervalMinutes: 10,
  showComposerPill: true,
};

/** What the server assumes when the document is unreadable: everything off, no retries, no polling. */
export const ROUTING_DEFAULTS_OFF: RoutingSettingsShape = {
  routeAgents: false,
  autoResetBackoff: false,
  retryOnRateLimit: false,
  maxRetriesPerAgent: 0,
  healthChecks: false,
  healthIntervalMinutes: ROUTING_DEFAULTS.healthIntervalMinutes,
  showComposerPill: false,
};

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/**
 * Fill in a stored `values` object from any known schema version. Fields a
 * version did not have take the schema default, so a v1 document keeps the
 * user's routing choices and simply gains the v2 health defaults. This is the
 * same conversion `defineSettings.migrate` runs on the host.
 */
export function upgradeRoutingValues(values: unknown): RoutingSettingsShape {
  const record = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
  const bool = (key: keyof RoutingSettingsShape) =>
    typeof record[key] === "boolean" ? (record[key] as boolean) : ROUTING_DEFAULTS[key] === true;
  return {
    routeAgents: bool("routeAgents"),
    autoResetBackoff: bool("autoResetBackoff"),
    retryOnRateLimit: bool("retryOnRateLimit"),
    maxRetriesPerAgent: clampInteger(record.maxRetriesPerAgent, 0, 5, ROUTING_DEFAULTS.maxRetriesPerAgent),
    healthChecks: bool("healthChecks"),
    healthIntervalMinutes: clampInteger(
      record.healthIntervalMinutes,
      HEALTH_INTERVAL_MIN_MINUTES,
      HEALTH_INTERVAL_MAX_MINUTES,
      ROUTING_DEFAULTS.healthIntervalMinutes,
    ),
    showComposerPill: bool("showComposerPill"),
  };
}

/**
 * Decode the daemon's settings envelope `{ version, values }`. `null` raw means
 * the file is missing, which is the defaults. Any version this build knows
 * (older included) is upgraded in place; anything malformed or from a newer
 * schema is treated as everything off, never as the user's saved choices.
 */
export function parseRoutingEnvelope(raw: string | null): RoutingSettingsShape {
  if (raw === null) return ROUTING_DEFAULTS;
  try {
    const envelope = JSON.parse(raw) as { version?: unknown; values?: unknown };
    if (typeof envelope.version !== "number" || !ROUTING_SETTINGS_KNOWN_VERSIONS.includes(envelope.version)) {
      return ROUTING_DEFAULTS_OFF;
    }
    return upgradeRoutingValues(envelope.values);
  } catch {
    return ROUTING_DEFAULTS_OFF;
  }
}

/** Only Claude-shaped sessions read ANTHROPIC_*; Codex has its own config and is never touched. */
export function routedSessionKind(provider: string, routerProviderId: string): "claude" | "ninerouter" | null {
  if (provider === "claude") return "claude";
  if (provider === routerProviderId) return "ninerouter";
  return null;
}

const RATE_LIMIT = /429|rate.?limit|no available account|all .*accounts? (parked|unavailable)/i;

export function isRateLimitError(message: string | null | undefined): boolean {
  return typeof message === "string" && RATE_LIMIT.test(message);
}

/**
 * Which 9router provider pool an agent's model draws from. Routed ids carry a
 * pool prefix (`cc/` for Claude); anything without a Claude prefix that runs on
 * the router is Codex. Direct Paseo providers map by name.
 */
export function poolForAgent(provider: string, model: string | null, routerProviderId: string): "claude" | "codex" | null {
  if (provider === "claude") return "claude";
  if (provider === "codex") return "codex";
  if (provider !== routerProviderId) return null;
  if (!model) return null;
  if (model.startsWith("cc/") || /claude/i.test(model)) return "claude";
  return "codex";
}

export type AgentRouting = {
  /** True only when the session's provider is the 9Router provider; the env hook cannot be observed from a client. */
  routed: boolean;
  pool: "claude" | "codex" | null;
  /** routed = via 9Router; direct = talks to a pool's provider itself; unserved = a provider 9router does not carry. */
  verdict: "routed" | "direct" | "unserved";
  label: string;
};

/**
 * One agent's relationship to the router, as every surface should describe it.
 * Only the provider is evidence: an agent on the 9Router provider is routed, a
 * Claude or Codex agent is talking to its provider directly, anything else is
 * not 9router's business. Whether the session_open hook injected the router's
 * environment into a `claude` session is not visible from the client, so it is
 * never claimed here.
 */
export function agentRouting(provider: string, model: string | null, routerProviderId: string): AgentRouting {
  const pool = poolForAgent(provider, model, routerProviderId);
  if (provider === routerProviderId) return { routed: true, pool, verdict: "routed", label: "Via 9Router" };
  if (pool === null) return { routed: false, pool: null, verdict: "unserved", label: "Not served by 9router" };
  return { routed: false, pool, verdict: "direct", label: pool === "codex" ? "Direct · never routed" : "Direct provider" };
}

/** Accounts worth resetting: the pool's active connections currently in backoff. */
export function connectionsToReset<T extends { provider: string; isActive: boolean; backoffLevel: number }>(
  connections: readonly T[],
  pool: "claude" | "codex",
): T[] {
  return connections.filter((entry) => entry.provider === pool && entry.isActive && entry.backoffLevel > 0);
}

/** One retry decision; the caller owns the counter and increments on `true`. */
export function shouldRetry(settings: RoutingSettingsShape, retriesSoFar: number): boolean {
  return settings.autoResetBackoff && settings.retryOnRateLimit && retriesSoFar < settings.maxRetriesPerAgent;
}

type HealthConnection = { provider: string; isActive: boolean; backoffLevel: number };

/**
 * Active accounts 9router has backed off past the stuck threshold. They still
 * count as serving slots, so the pool looks healthier than it is.
 */
export function stuckConnections<T extends HealthConnection>(connections: readonly T[], threshold: number = STUCK_BACKOFF_LEVEL): T[] {
  return connections.filter((entry) => entry.isActive && entry.backoffLevel >= threshold);
}

export type PoolVerdict = {
  pool: "claude" | "codex";
  /** Active accounts with no backoff. */
  ready: number;
  /** Active accounts in any backoff, stuck ones included. */
  resting: number;
  /** Active accounts at or past the stuck threshold. */
  stuck: number;
};

/** Per-pool counts the pill and panels read, so every surface agrees on the numbers. */
export function poolVerdict<T extends HealthConnection>(connections: readonly T[], pool: "claude" | "codex", threshold: number = STUCK_BACKOFF_LEVEL): PoolVerdict {
  const active = connections.filter((entry) => entry.provider === pool && entry.isActive);
  return {
    pool,
    ready: active.filter((entry) => entry.backoffLevel === 0).length,
    resting: active.filter((entry) => entry.backoffLevel > 0).length,
    stuck: active.filter((entry) => entry.backoffLevel >= threshold).length,
  };
}

export type PillDecision = {
  show: boolean;
  /** Short text for the pill; empty when `show` is false. */
  label: string;
  tone: "neutral" | "warning" | "danger";
};

/**
 * Whether an agent's composer deserves a 9Router pill, and what it says. A pill
 * on every composer saying "all good" is noise, so one exists only when there is
 * something to act on: the router is unreachable while routing is on, accounts
 * of this agent's pool are resting or stuck, or the agent is bypassing an
 * enabled pool entirely.
 */
export function pillDecision(input: {
  settings: Pick<RoutingSettingsShape, "routeAgents" | "showComposerPill">;
  /** null when the cache has never been filled or the router was unreachable. */
  verdict: PoolVerdict | null;
  routerReachable: boolean;
  routed: boolean;
  pool: "claude" | "codex" | null;
}): PillDecision {
  const { settings, verdict, routerReachable, routed, pool } = input;
  const hidden: PillDecision = { show: false, label: "", tone: "neutral" };
  if (!settings.showComposerPill || pool === null) return hidden;
  if (!routerReachable) {
    return settings.routeAgents || routed ? { show: true, label: "9Router offline", tone: "danger" } : hidden;
  }
  if (verdict === null) return hidden;
  if (verdict.stuck > 0) {
    return { show: true, label: `${verdict.stuck} account${verdict.stuck === 1 ? "" : "s"} stuck`, tone: "danger" };
  }
  if (verdict.resting > 0) {
    return {
      show: true,
      label: `${verdict.resting} resting · ${verdict.ready} ready`,
      tone: verdict.ready === 0 ? "danger" : "warning",
    };
  }
  if (verdict.ready === 0 && (routed || settings.routeAgents)) {
    return { show: true, label: "No accounts", tone: "danger" };
  }
  if (settings.routeAgents && !routed) return { show: true, label: "Not routed", tone: "warning" };
  return hidden;
}
