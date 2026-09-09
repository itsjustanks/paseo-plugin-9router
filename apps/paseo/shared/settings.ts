import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";
import { ROUTING_SETTINGS_VERSION } from "./routing-logic";

/**
 * Per-agent routing preferences. Host-scoped: every client of this daemon
 * shares one document, and the server hooks read the same values.
 */
export const RoutingSettingsSchema = z.object({
  /** Inject 9router's base URL and key into Claude sessions Paseo opens, leaving ~/.claude alone. */
  routeAgents: z.boolean().default(false),
  /** When a turn fails on a rate limit, reset backoff on every account that can serve that model. */
  autoResetBackoff: z.boolean().default(true),
  /** After resetting backoff, ask the agent to retry its last request. */
  retryOnRateLimit: z.boolean().default(false),
  /** Cap on automatic retries per agent for the life of the plugin process. */
  maxRetriesPerAgent: z.number().int().min(0).max(5).default(1),
});

export type RoutingSettings = z.infer<typeof RoutingSettingsSchema>;

export const ROUTING_SETTINGS_ID = "routing";

export const routingSettings = defineSettings({
  id: ROUTING_SETTINGS_ID,
  scope: "host",
  version: ROUTING_SETTINGS_VERSION,
  schema: RoutingSettingsSchema,
});

