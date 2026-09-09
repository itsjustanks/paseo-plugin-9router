import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "../apps/paseo/node_modules/typescript/lib/typescript.js";

const staging = mkdtempSync(join(tmpdir(), "router-astra-"));
try {
  // The handler wrapper owns runtime imports; exercise its workflow with a router and SDK double.
  const source = readFileSync(new URL("../apps/paseo/server/astra.ts", import.meta.url), "utf8")
    .replace(/import \{ RouterClient, readSettings, writeSettings \} from "\.\/router";\n/, "");
  writeFileSync(join(staging, "astra.mjs"), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const { addAstra } = await import(join(staging, "astra.mjs"));
  const target = "cx/gpt-6-astra";
  function fixture(options = {}) {
    const state = { ids: options.existing ? [target] : ["cx/gpt-5.6-sol"], aliases: options.aliases ?? {}, writes: [], refreshes: [], savedSelection: null };
    const settings = { url: "http://127.0.0.1:20128", apiKey: "test-only", password: null, syncSelection: options.selection ?? [] };
    const direct = { codex: { enabled: true, command: ["codex"] }, claude: { enabled: true } };
    const provider = { models: [{ id: "cc/existing", label: "Existing" }], env: { CUSTOM: "preserve" }, extends: "claude" };
    const config = { providers: { ...structuredClone(direct), ...(options.noProvider ? {} : { ninerouter: provider }) } };
    const client = {
      authError: null,
      api: async () => options.authFailure ? null : { aliases: state.aliases },
      models: async () => [...state.ids],
      apiJson: async (path, method, body) => {
        state.writes.push({ path, method, body });
        if (options.fail === path) return { success: false, error: "simulated failure" };
        if (path === "models/custom") state.ids.push(target);
        if (path === "models/alias") state.aliases[body.alias] = body.model;
        return { success: true };
      },
    };
    const paseo = {
      config: { get: async () => ({ config }), patch: async patch => {
        assert.deepEqual(Object.keys(patch.agents.providers), ["ninerouter"]);
        const next = patch.agents.providers.ninerouter;
        config.providers.ninerouter = { ...config.providers.ninerouter, ...next };
      } },
      providers: { refresh: async ({ providers }) => {
        assert.deepEqual(providers, ["ninerouter"]);
        state.refreshes.push(providers);
        if (options.refreshFailure) throw new Error("refresh failed");
      }, waitForReady: async () => {} },
    };
    return { state, settings, config, direct, run: () => addAstra(client, settings, paseo, selected => {
      state.savedSelection = selected; settings.syncSelection = selected;
    }) };
  }
  const fresh = fixture({ selection: ["cx/gpt-5.6-sol"] });
  assert.equal((await fresh.run()).ok, true);
  assert.equal(fresh.state.aliases["gpt-6-astra"], target);
  assert.deepEqual(fresh.state.savedSelection, ["cx/gpt-5.6-sol", target]);
  assert.deepEqual(fresh.config.providers.codex, fresh.direct.codex);
  assert.deepEqual(fresh.config.providers.claude, fresh.direct.claude);
  assert.deepEqual(fresh.config.providers.ninerouter.env, { CUSTOM: "preserve" });
  assert.equal(fresh.config.providers.ninerouter.models[0].id, "cc/existing");
  const writes = fresh.state.writes.length;
  assert.equal((await fresh.run()).ok, true);
  assert.equal(fresh.state.writes.length, writes);
  assert.equal(fresh.config.providers.ninerouter.models.filter(m => m.id === target).length, 1);
  for (const options of [{ authFailure: true }, { aliases: { "gpt-6-astra": "another/model" } }]) {
    const f = fixture(options); assert.equal((await f.run()).ok, false); assert.equal(f.state.writes.length, 0);
  }
  for (const fail of ["models/custom", "models/alias"]) {
    const f = fixture({ fail }); assert.equal((await f.run()).ok, false); assert.equal(f.state.refreshes.length, 0);
  }
  const missing = fixture({ noProvider: true }); assert.equal((await missing.run()).ok, true);
  assert.equal(missing.config.providers.ninerouter.extends, "claude");
  assert.equal(missing.state.savedSelection, null);
  const refresh = fixture({ refreshFailure: true }); assert.equal((await refresh.run()).ok, false);
  console.log("Astra workflow passed: registration, alias, picker isolation, retries, shortlist, conflicts and failures.");
} finally { rmSync(staging, { recursive: true, force: true }); }
