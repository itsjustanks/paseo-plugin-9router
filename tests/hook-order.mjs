// Mounts every contributed client component with no data, then with data, and
// fails on any React hook-order complaint. 0.11.0 to 0.14.0 shipped a
// useMutation after the surface's loading return — React error #310 in the
// app — because nothing rendered these components outside Paseo.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = join(here, "..", "apps", "paseo");
process.env.NODE_ENV = "development";

const build = spawnSync(process.execPath, [join(plugin, "node_modules", "vite", "bin", "vite.js"), "build", "--config", join(plugin, "tests", "hook-order", "vite.config.mts")], {
  cwd: plugin,
  stdio: "inherit",
});
if (build.status !== 0) {
  console.error("hook-order: bundling the test entry failed");
  process.exit(1);
}

const { mounts, renderThroughDataArrival } = await import(join(plugin, "node_modules", ".cache", "hook-order", "entry.mjs"));

let failed = 0;
for (const name of Object.keys(mounts)) {
  const complaints = [];
  const original = console.error;
  console.error = (...args) => {
    const line = args.map(String).join(" ");
    if (/order of Hooks|Rendered more hooks|Rendered fewer hooks|Should have a queue/.test(line)) complaints.push(line);
    // The renderer's own deprecation notice is not a finding about the plugin.
    else if (!/react-test-renderer is deprecated/.test(line)) original(...args);
  };
  try {
    const { before, after } = await renderThroughDataArrival(name);
    assert.equal(complaints.length, 0, `${name}: ${complaints[0]?.split("\n")[0]}`);
    assert.ok(before.nodes > 0, `${name}: rendered nothing before data arrived`);
    assert.ok(after.nodes > 0, `${name}: rendered nothing after data arrived`);
    console.log(`ok   ${name} (${before.nodes} elements before data, ${after.nodes} after)`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    console.error = original;
  }
}

if (failed) {
  console.error(`hook-order: ${failed} failing`);
  process.exit(1);
}
console.log("hook-order: every component keeps its hook order across data arrival");
