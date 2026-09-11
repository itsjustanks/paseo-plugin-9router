#!/usr/bin/env node
// Transcript usage: the parser, indexer and report model adapted from
// session-usage (panrafal, MIT; see THIRD-PARTY-NOTICES.md). The sources and
// their tests are TypeScript; Node 20 has no type stripping, so they are
// transpiled with the installed compiler into the plugin's node_modules cache
// (where `zod` resolves) and run under node:test.
//
// Run: node tests/usage.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "../apps/paseo/node_modules/typescript/lib/typescript.js";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = join(here, "..", "apps", "paseo");
const staging = join(plugin, "node_modules", ".cache", "usage-tests");
rmSync(staging, { recursive: true, force: true });

const files = [
  "shared/usage-schema.ts", "shared/usage-pricing.ts", "shared/usage-model.ts", "shared/usage-calendar.ts",
  "server/transcript-parser.ts", "server/transcript-index.ts",
  "tests/usage/parser.test.ts", "tests/usage/indexer.test.ts", "tests/usage/model.test.ts",
];
for (const file of files) {
  const source = readFileSync(join(plugin, file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  // ESM needs explicit extensions on relative imports; the TS sources omit them.
  const rewritten = outputText.replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_match, open, specifier, close) => `${open}${specifier}.mjs${close}`);
  const target = join(staging, file.replace(/\.ts$/, ".mjs"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, rewritten);
}

const run = spawnSync(process.execPath, ["--test", ...files.filter((file) => file.endsWith(".test.ts")).map((file) => join(staging, file.replace(/\.ts$/, ".mjs")))], { stdio: "inherit" });
if (run.status !== 0) {
  console.error("usage: transcript parser/indexer/model tests failed");
  process.exit(run.status ?? 1);
}
console.log("usage: parser, indexer and model tests pass");
