import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { ROUTING_SETTINGS_ID } from "../shared/settings";
import { parseRoutingEnvelope, routedSessionKind, type RoutingSettingsShape } from "../shared/routing-logic";
import { PROVIDER_ID, claudeRoutingEnv } from "./handlers";
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

export function registerRoutingHooks(server: PluginServerContext): void {
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
