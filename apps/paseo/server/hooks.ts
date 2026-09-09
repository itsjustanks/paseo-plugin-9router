import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { ROUTING_SETTINGS_ID } from "../shared/settings";
import {
  connectionsToReset,
  isRateLimitError,
  parseRoutingEnvelope,
  poolForAgent,
  routedSessionKind,
  shouldRetry,
  type RoutingSettingsShape,
} from "../shared/routing-logic";
import { PROVIDER_ID, claudeRoutingEnv, handleRouterClearHold, handleRouterConnectionHealth } from "./handlers";
import { RouterClient, readSettings } from "./router";

/** The id in paseo-plugin.json; the daemon names the settings directory after it. */
const PLUGIN_ID = "agent-link-9router";

/**
 * @getpaseo/plugin/server 0.8.0-beta.1 has no server-side settings read API:
 * `registerSettings` only wires the client RPCs. The daemon's PluginSettingsStore
 * persists each document as
 *   $PASEO_HOME/plugin-settings/<pluginId>/<settingsId>.json
 * with the envelope `{ "version": <schema version>, "values": { ... } }`, where
 * PASEO_HOME defaults to ~/.paseo. The hooks read that file directly.
 */
export function routingSettingsPath(): string {
  const home = process.env.PASEO_HOME?.replace(/^~(?=$|\/)/, homedir()) || join(homedir(), ".paseo");
  return join(home, "plugin-settings", PLUGIN_ID, `${ROUTING_SETTINGS_ID}.json`);
}

/** Missing file = never saved = schema defaults. Any other failure = everything off. */
export async function readRoutingSettings(path: string = routingSettingsPath()): Promise<RoutingSettingsShape> {
  try {
    return parseRoutingEnvelope(await readFile(path, "utf8"));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null;
    return parseRoutingEnvelope(code === "ENOENT" ? null : "unreadable");
  }
}

/** Log each distinct failure once; a hook fires for every session and must not flood the plugin log. */
const reported = new Set<string>();
export function reportOnce(message: string): void {
  if (reported.has(message)) return;
  reported.add(message);
  console.error(`[9router routing] ${message}`);
}

/**
 * Automatic retries sent per agent for the life of this plugin process. The cap
 * from settings is checked against this before every send, so a pool that stays
 * dead can never bounce an agent in a loop. Reloading the plugin resets it.
 */
const retriesByAgent = new Map<string, number>();

export function registerRoutingHooks(server: PluginServerContext): void {
  server.on("agent.turn_ended", async (event, context) => {
    try {
      if (event.outcome.kind !== "failed" || !isRateLimitError(event.outcome.error.message)) return;
      const settings = await readRoutingSettings();
      if (!settings.autoResetBackoff) return;

      const agentId = event.agent.id;
      // The hook payload carries the provider but not the model; the snapshot does.
      const handle = context.paseo.agents.ref(agentId);
      const model = handle.current()?.model ?? (await handle.refresh())?.agent.model ?? null;
      const pool = poolForAgent(event.agent.provider, model, PROVIDER_ID);
      if (!pool) {
        console.log(`[9router backoff] ${agentId} failed on a rate limit but ${event.agent.provider}/${model ?? "?"} maps to no 9router pool; nothing to reset.`);
        return;
      }

      const health = await handleRouterConnectionHealth();
      const resting = connectionsToReset(health.connections, pool);
      console.log(`[9router backoff] ${agentId} (${event.agent.provider}, ${model ?? "no model"}) hit a rate limit; resetting ${resting.length} ${pool} account(s) in backoff.`);
      for (const connection of resting) {
        const result = await handleRouterClearHold({ provider: pool, model: model ?? "", connectionId: connection.id });
        console.log(`[9router backoff] ${connection.email || connection.name || connection.id}: ${result.message}`);
      }

      const retries = retriesByAgent.get(agentId) ?? 0;
      if (!shouldRetry(settings, retries)) {
        if (settings.retryOnRateLimit) console.log(`[9router backoff] ${agentId} reached the retry cap (${settings.maxRetriesPerAgent}); not retrying.`);
        return;
      }
      retriesByAgent.set(agentId, retries + 1);
      await handle.send("Retry the last request.");
      console.log(`[9router backoff] asked ${agentId} to retry (${retries + 1}/${settings.maxRetriesPerAgent}).`);
    } catch (error) {
      reportOnce(`turn_ended hook failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  server.before("agent.session_open", async ({ request }) => {
    try {
      const kind = routedSessionKind(request.provider, PROVIDER_ID);
      if (!kind) return request;
      const settings = await readRoutingSettings();
      if (!settings.routeAgents) return request;

      const router = readSettings();
      const client = new RouterClient(router);
      const key = await client.ensureApiKey();
      if (!key) {
        reportOnce(`Not routing ${request.agentId}: ${client.authError ?? "9router returned no API key"}.`);
        return request;
      }
      const env = await claudeRoutingEnv(client, router.url, key);
      const slots = Object.keys(env).filter((name) => name.startsWith("ANTHROPIC_DEFAULT_")).length;
      console.log(`[9router routing] ${kind} session ${request.agentId} (${request.reason}) routed through ${router.url} with ${slots} model slots.`);
      return { ...request, env: { ...request.env, ...env } };
    } catch (error) {
      reportOnce(`session_open hook failed, leaving the request unchanged: ${error instanceof Error ? error.message : String(error)}`);
      return request;
    }
  });
}
