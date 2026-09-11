/**
 * Renders every component the plugin contributes twice: once with the host
 * store empty and no RPC answered, once after both arrive. A hook placed after
 * an early return changes the hook count between those renders, which React's
 * development build reports by name before throwing #310.
 */
import React from "react";
import { act, create } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentLinkSurface } from "../../client/surface";
import { RouterAgentPanel } from "../../client/agent-panel";
import { RoutingPill } from "../../client/pill";
import { RoutingSettingsScreen } from "../../client/settings";
import { AgentUsageCard, TranscriptUsageSection } from "../../client/usage";
// The same module the vite alias hands the client under "@getpaseo/plugin/client".
import { releaseRpc, setHostDataReady } from "./stubs/plugin";

const colors = {
  surface0: "#000", surface1: "#111", surface2: "#222", border: "#333", foreground: "#fff", foregroundMuted: "#aaa",
  accent: "#88f", accentForeground: "#000", statusSuccess: "#0f0", statusWarning: "#ff0", statusDanger: "#f00",
};
const base = { theme: { colors }, host: { id: "test", label: "test" }, layout: { compact: false, platform: "web" as const } };
const navigation = { openAgent() {}, openWorkspace() {} };

export const mounts: Record<string, () => React.ReactElement> = {
  surface: () => <AgentLinkSurface {...base} navigation={navigation} />,
  "agent panel": () => <RouterAgentPanel {...base} context="agent" workspaceId="ws-1" agentId="agent-1" navigation={navigation} />,
  "agent panel (unknown agent)": () => <RouterAgentPanel {...base} context="agent" workspaceId="ws-1" agentId="missing" navigation={navigation} />,
  pill: () => <RoutingPill {...base} workspaceId="ws-1" agentId="agent-1" />,
  "settings screen": () => <RoutingSettingsScreen {...base} navigation={navigation} />,
  // The surface mounts on Overview, so the Sessions & agents tab's section is mounted on
  // its own: bars, calendar and table, router side loading then answered.
  "usage section": () => <TranscriptUsageSection theme={base.theme} compact={false} navigation={navigation} period="30d" onPeriod={() => {}} live router={{ loading: true, ok: false, message: null, totals: null }} />,
  "usage section (compact, router offline)": () => <TranscriptUsageSection theme={base.theme} compact navigation={undefined} period="all" onPeriod={() => {}} live={false} router={{ loading: false, ok: false, message: "9router did not answer.", totals: null }} />,
  "agent usage card": () => <AgentUsageCard theme={base.theme} agentId="agent-1" provider="ninerouter" />,
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Mount one component through the absent -> present transition. Returns each
 * state's host element count and text: the surface's loading state is a lone
 * ActivityIndicator, so text alone cannot prove it rendered.
 */
export async function renderThroughDataArrival(name: string): Promise<{ before: { nodes: number; text: string }; after: { nodes: number; text: string } }> {
  setHostDataReady(false);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const element = <QueryClientProvider client={queryClient}>{mounts[name]()}</QueryClientProvider>;
  let renderer!: ReturnType<typeof create>;
  await act(async () => { renderer = create(element); });
  await act(flush);
  const before = describe(renderer.toJSON());
  await act(async () => { setHostDataReady(true); releaseRpc(); await flush(); await flush(); });
  await act(flush);
  const after = describe(renderer.toJSON());
  await act(async () => { renderer.unmount(); });
  queryClient.clear();
  return { before, after };
}

function describe(tree: any): { nodes: number; text: string } {
  let nodes = 0;
  const text = (node: any): string => {
    if (node === null || node === undefined || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join(" ");
    nodes += 1;
    return text(node.children);
  };
  const joined = text(tree);
  return { nodes, text: joined };
}
