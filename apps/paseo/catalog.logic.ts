export type CatalogSort = "model" | "provider" | "state";
export type ModelReadiness = { id: string; state: string; usable: number; accounts: number };
export function catalogPage(ids: string[], readiness: ModelReadiness[], query: string, sort: CatalogSort, descending: boolean, page: number, size = 12) {
  const byId = new Map(readiness.map((model) => [model.id, model]));
  const rows = [...new Set(ids)].map((id) => ({ id, provider: id.includes("/") ? id.split("/")[0] : "combo", state: byId.get(id)?.state ?? "unknown", usable: byId.get(id)?.usable ?? null, accounts: byId.get(id)?.accounts ?? null }))
    .filter((model) => `${model.id} ${model.provider} ${model.state}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => ((sort === "model" ? a.id.localeCompare(b.id) : a[sort].localeCompare(b[sort]) || a.id.localeCompare(b.id)) * (descending ? -1 : 1)));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  return { rows: rows.slice(current * size, (current + 1) * size), total: rows.length, page: current, pages };
}
