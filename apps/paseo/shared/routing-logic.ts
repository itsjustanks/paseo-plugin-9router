/**
 * Pure decisions behind the per-agent routing and backoff hooks. Kept free of
 * imports so the tests can load it without a daemon, a router, or the SDK.
 */

export type RoutingSettingsShape = {
  routeAgents: boolean;
  autoResetBackoff: boolean;
  retryOnRateLimit: boolean;
  maxRetriesPerAgent: number;
};

export const ROUTING_SETTINGS_VERSION = 1;

/** The schema's defaults; what an unsaved document means. */
export const ROUTING_DEFAULTS: RoutingSettingsShape = {
  routeAgents: false,
  autoResetBackoff: true,
  retryOnRateLimit: false,
  maxRetriesPerAgent: 1,
};

/** What the server assumes when the document is unreadable: everything off, no retries. */
export const ROUTING_DEFAULTS_OFF: RoutingSettingsShape = {
  routeAgents: false,
  autoResetBackoff: false,
  retryOnRateLimit: false,
  maxRetriesPerAgent: 0,
};

/**
 * Decode the daemon's settings envelope `{ version, values }`. `null` raw means
 * the file is missing, which is the defaults; anything malformed or from
 * another schema version is treated as everything off.
 */
export function parseRoutingEnvelope(raw: string | null): RoutingSettingsShape {
  if (raw === null) return ROUTING_DEFAULTS;
  try {
    const envelope = JSON.parse(raw) as { version?: unknown; values?: unknown };
    if (envelope.version !== ROUTING_SETTINGS_VERSION) return ROUTING_DEFAULTS_OFF;
    const values = (envelope.values ?? {}) as Record<string, unknown>;
    const bool = (key: keyof RoutingSettingsShape) =>
      typeof values[key] === "boolean" ? (values[key] as boolean) : ROUTING_DEFAULTS[key] === true;
    const retries = values.maxRetriesPerAgent;
    return {
      routeAgents: bool("routeAgents"),
      autoResetBackoff: bool("autoResetBackoff"),
      retryOnRateLimit: bool("retryOnRateLimit"),
      maxRetriesPerAgent:
        typeof retries === "number" && Number.isInteger(retries) && retries >= 0 && retries <= 5
          ? retries
          : ROUTING_DEFAULTS.maxRetriesPerAgent,
    };
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
