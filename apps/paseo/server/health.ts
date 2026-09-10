import { poolVerdict, stuckConnections, STUCK_BACKOFF_LEVEL, type PoolVerdict, type RoutingSettingsShape } from "../shared/routing-logic";
import { handleRouterConnectionHealth } from "./handlers";
import { readRoutingSettings, reportOnce } from "./hooks";
import { RouterClient } from "./router";

type StuckAccount = {
  id: string;
  provider: string;
  label: string;
  backoffLevel: number;
  lastError: string;
  lastErrorAt: string | null;
};

export type RoutingHealthSnapshot = {
  checkedAt: string | null;
  routerReachable: boolean;
  routeAgents: boolean;
  showComposerPill: boolean;
  healthChecks: boolean;
  pools: PoolVerdict[];
  stuck: StuckAccount[];
};

const POOLS = ["claude", "codex"] as const;

/** Never older than this when a client asks, even with background checks off. */
const ON_DEMAND_MAX_AGE_MS = 60_000;

/** The settings file is cheap to read and is how a user changes the interval without a reload. */
const SETTINGS_RECHECK_MS = 60_000;

const EMPTY: RoutingHealthSnapshot = {
  checkedAt: null,
  routerReachable: false,
  routeAgents: false,
  showComposerPill: false,
  healthChecks: false,
  pools: [],
  stuck: [],
};

let cache: RoutingHealthSnapshot = EMPTY;
let inflight: Promise<RoutingHealthSnapshot> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Ids of accounts already reported as stuck, so the log says it once per episode. */
const reportedStuck = new Set<string>();

/** One check: settings, reachability, every account's backoff. Never throws. */
export async function refreshRoutingHealth(settings?: RoutingSettingsShape): Promise<RoutingHealthSnapshot> {
  if (inflight) return inflight;
  inflight = (async () => {
    const current = settings ?? (await readRoutingSettings());
    const base = {
      checkedAt: new Date().toISOString(),
      routeAgents: current.routeAgents,
      showComposerPill: current.showComposerPill,
      healthChecks: current.healthChecks,
    };
    try {
      const client = new RouterClient();
      if (!(await client.health())) {
        cache = { ...base, routerReachable: false, pools: [], stuck: [] };
        return cache;
      }
      const { connections } = await handleRouterConnectionHealth();
      const stuck = stuckConnections(connections, STUCK_BACKOFF_LEVEL).map((entry) => ({
        id: entry.id,
        provider: entry.provider,
        label: entry.email || entry.name || entry.id.slice(0, 8),
        backoffLevel: entry.backoffLevel,
        lastError: entry.lastError,
        lastErrorAt: entry.lastErrorAt,
      }));
      for (const account of stuck) {
        if (reportedStuck.has(account.id)) continue;
        reportedStuck.add(account.id);
        // Email is the account's display name in 9router; no token or key is ever in this line.
        console.warn(`[9router health] ${account.label} (${account.provider}) is active but stuck at backoff ${account.backoffLevel}${account.lastError ? `: ${account.lastError}` : ""}. It counts as a slot while serving nothing; reset its backoff from the 9Router panel.`);
      }
      for (const id of reportedStuck) if (!stuck.some((account) => account.id === id)) reportedStuck.delete(id);
      cache = {
        ...base,
        routerReachable: true,
        pools: POOLS.map((pool) => poolVerdict(connections, pool, STUCK_BACKOFF_LEVEL)),
        stuck,
      };
      return cache;
    } catch (error) {
      reportOnce(`health check failed: ${error instanceof Error ? error.message : String(error)}`);
      cache = { ...base, routerReachable: false, pools: [], stuck: [] };
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The cache, refreshed on demand when it has gone stale or was never filled. */
export async function handleRouterRoutingHealth(): Promise<RoutingHealthSnapshot> {
  const age = cache.checkedAt ? Date.now() - Date.parse(cache.checkedAt) : Number.POSITIVE_INFINITY;
  if (age > ON_DEMAND_MAX_AGE_MS) return refreshRoutingHealth();
  return cache;
}

/**
 * Background poller. Re-reads the settings document on every tick so turning
 * checks off or changing the interval takes effect without a plugin reload;
 * while checks are off it only wakes to look at the settings again.
 */
export function startRoutingHealthPoller(): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    let delay = SETTINGS_RECHECK_MS;
    try {
      const settings = await readRoutingSettings();
      if (settings.healthChecks) {
        await refreshRoutingHealth(settings);
        delay = settings.healthIntervalMinutes * 60_000;
      }
    } catch (error) {
      reportOnce(`health poller tick failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!stopped) timer = setTimeout(tick, delay);
  };
  timer = setTimeout(tick, 5_000);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
