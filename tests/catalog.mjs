import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "../apps/paseo/node_modules/typescript/lib/typescript.js";
const staging = mkdtempSync(join(tmpdir(), "router-catalog-"));
try {
  const source = readFileSync(new URL("../apps/paseo/client/catalog-logic.ts", import.meta.url), "utf8");
  writeFileSync(join(staging, "catalog.mjs"), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { catalogPage } = await import(join(staging, "catalog.mjs"));
  const ids = [...Array.from({ length: 96 }, (_, i) => `demo/model-${String(i).padStart(2, "0")}`), "cx/gpt-6-astra"];
  const pages = Array.from({ length: 9 }, (_, page) => catalogPage(ids, [], "", "model", false, page));
  assert.equal(new Set(pages.flatMap((page) => page.rows.map((row) => row.id))).size, 97, "Every model remains reachable beyond the old first-60 limit");
  const astra = catalogPage(ids, [], " ASTRA ", "model", false, 8);
  assert.equal(astra.page, 0); assert.equal(astra.total, 1); assert.equal(astra.rows[0].state, "unknown");
  const readiness = [{ id: "cx/gpt-6-astra", state: "ready", usable: 1, accounts: 2 }];
  assert.equal(catalogPage(ids, readiness, "ready", "state", false, 0).rows[0].usable, 1);
  const asc = catalogPage(ids, [], "", "model", false, 0, 200).rows;
  const desc = catalogPage(ids, [], "", "model", true, 0, 200).rows;
  assert.deepEqual(asc.map((row) => row.id).reverse(), desc.map((row) => row.id));
  assert.equal(catalogPage(["cx/a", "cx/a"], [], "", "provider", false, 0).total, 1);
  const empty = catalogPage(ids, [], "missing model", "model", false, 5);
  assert.equal(empty.total, 0); assert.equal(empty.page, 0); assert.equal(empty.pages, 1);
  console.log("✓ Catalog reachability, filtering, sorting, pagination, and unknown readiness checks passed");
} finally { rmSync(staging, { recursive: true, force: true }); }
