import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";
import {
  HEALTH_INTERVAL_MAX_MINUTES,
  HEALTH_INTERVAL_MIN_MINUTES,
  ROUTING_DEFAULTS,
  ROUTING_SETTINGS_VERSION,
  upgradeRoutingValues,
} from "./routing-logic";

/**
 * Per-agent routing preferences. Host-scoped: every client of this daemon
 * shares one document, and the server hooks read the same values.
 */
export const RoutingSettingsSchema = z.object({
  /** Inject 9router's base URL and key into Claude sessions Paseo opens, leaving ~/.claude alone. */
  routeAgents: z.boolean().default(ROUTING_DEFAULTS.routeAgents),
  /** When a turn fails on a rate limit, reset backoff on every account that can serve that model. */
  autoResetBackoff: z.boolean().default(ROUTING_DEFAULTS.autoResetBackoff),
  /** After resetting backoff, ask the agent to retry its last request. */
  retryOnRateLimit: z.boolean().default(ROUTING_DEFAULTS.retryOnRateLimit),
  /** Cap on automatic retries per agent for the life of the plugin process. */
  maxRetriesPerAgent: z.number().int().min(0).max(5).default(ROUTING_DEFAULTS.maxRetriesPerAgent),
  /** Poll 9router's account health in the background so pills and panels read a cache. */
  healthChecks: z.boolean().default(ROUTING_DEFAULTS.healthChecks),
  /** Minutes between background checks. */
  healthIntervalMinutes: z
    .number()
    .int()
    .min(HEALTH_INTERVAL_MIN_MINUTES)
    .max(HEALTH_INTERVAL_MAX_MINUTES)
    .default(ROUTING_DEFAULTS.healthIntervalMinutes),
  /** Show the routing-health pill in agent composers when there is something to say. */
  showComposerPill: z.boolean().default(ROUTING_DEFAULTS.showComposerPill),
});

export type RoutingSettings = z.infer<typeof RoutingSettingsSchema>;

export const ROUTING_SETTINGS_ID = "routing";

export const routingSettings = defineSettings({
  id: ROUTING_SETTINGS_ID,
  scope: "host",
  version: ROUTING_SETTINGS_VERSION,
  schema: RoutingSettingsSchema,
  // A v1 document keeps its routing choices and gains the health defaults;
  // the same conversion the server hooks apply when they read the file directly.
  migrate: (values) => upgradeRoutingValues(values),
});
