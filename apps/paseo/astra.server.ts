import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { RouterClient, readSettings, writeSettings } from "./router.server";
import type { RouterSettings } from "./router.server";

const MODEL = "gpt-6-astra";
const ROUTED_MODEL = `cx/${MODEL}`;
const PROVIDER = "ninerouter";

/** Add Astra without rewriting CLI settings or refreshing direct providers. */
export async function addAstra(
  client: Pick<RouterClient, "api" | "apiJson" | "models" | "authError">,
  settings: RouterSettings,
  paseo: PluginHandlerContext["paseo"],
  saveSelection: (selected: string[]) => void,
): Promise<{ ok: boolean; message: string }> {
  const aliases = await client.api<{ aliases?: Record<string, string> }>("models/alias");
  if (!aliases?.aliases) return { ok: false, message: client.authError ?? "Could not read 9router aliases." };
  const previous = aliases.aliases[MODEL];
  if (previous && previous !== ROUTED_MODEL) {
    return { ok: false, message: `${MODEL} already points to ${previous}. Update it in Aliases before adding Astra.` };
  }
  if (!settings.apiKey) return { ok: false, message: "Save your 9router API key in Setup first." };

  if (!(await client.models()).includes(ROUTED_MODEL)) {
    const added = await client.apiJson<{ success?: boolean; error?: string }>("models/custom", "POST", {
      providerAlias: "cx", id: MODEL, name: "GPT-6 Astra", type: "llm",
    });
    if (!added?.success) return { ok: false, message: added?.error ?? client.authError ?? "Could not register Astra." };
  }
  if (!previous) {
    const aliased = await client.apiJson<{ success?: boolean; error?: string }>("models/alias", "PUT", {
      alias: MODEL, model: ROUTED_MODEL,
    });
    if (!aliased?.success) return { ok: false, message: `Astra is registered, but its alias failed: ${aliased?.error ?? client.authError ?? "retry Add GPT-6 Astra"}` };
  }
  if (!(await client.models()).includes(ROUTED_MODEL)) {
    return { ok: false, message: "Astra is registered but 9router is not listing it. Check that a Codex account is connected, then retry." };
  }

  const { config } = await paseo.config.get();
  type Entry = { models?: Array<{ id?: unknown; label?: unknown }> } & Record<string, unknown>;
  const shape = config as { providers?: Record<string, Entry>; agents?: { providers?: Record<string, Entry> } };
  const existing = (shape.providers ?? shape.agents?.providers)?.[PROVIDER];
  const models = existing?.models ?? [];
  const missing = !models.some((model) => model.id === ROUTED_MODEL);
  if (missing) {
    const entry = existing ? { models: [...models, { id: ROUTED_MODEL, label: "9Router · GPT-6 Astra" }] } : {
      extends: "claude", label: "9Router", description: "Every model your local 9router serves",
      env: { ANTHROPIC_BASE_URL: settings.url, ANTHROPIC_AUTH_TOKEN: settings.apiKey },
      models: [{ id: ROUTED_MODEL, label: "9Router · GPT-6 Astra" }],
    };
    await paseo.config.patch({ agents: { providers: { [PROVIDER]: entry } } } as never);
  }
  // An explicit shortlist must retain Astra on the next normal catalog sync.
  if (settings.syncSelection.length > 0 && !settings.syncSelection.includes(ROUTED_MODEL)) {
    saveSelection([...settings.syncSelection, ROUTED_MODEL]);
  }
  try {
    await paseo.providers.refresh({ providers: [PROVIDER] } as never);
    await paseo.providers.waitForReady({ timeoutMs: 20_000 } as never);
  } catch {
    return { ok: false, message: "Astra is saved in 9router and the picker configuration, but the picker refresh failed. Retry Add GPT-6 Astra." };
  }
  return { ok: true, message: "GPT-6 Astra is listed in 9Router. Use Test to check access with your connected accounts." };
}

export async function handleRouterAddAstra(_input: unknown, { paseo }: PluginHandlerContext) {
  const settings = readSettings();
  return addAstra(new RouterClient(settings), settings, paseo,
    (syncSelection) => { writeSettings({ syncSelection }); });
}
