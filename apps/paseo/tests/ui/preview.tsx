import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentLinkSurface } from "../../client/surface";
import { RouterWorkspacePanel } from "../../client/workspace-panel";
import { RouterAgentPanel } from "../../client/agent-panel";
import { RoutingPill } from "../../client/pill";
const queryClient = new QueryClient();
const params = new URLSearchParams(location.search);
// Render failures and React's hook-order warnings, kept where a headless run can read them.
const renderErrors: string[] = [];
Object.assign(window, { __renderErrors: renderErrors });
addEventListener("error", (event) => renderErrors.push(String(event.error?.message ?? event.message)));
const consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => { renderErrors.push(args.map(String).join(" ")); consoleError(...args); };
const light = params.has("light");
const colors = light ? {
  surface0: "#f5f6f8", surface1: "#ffffff", surface2: "#edf0f4", border: "#d7dbe1", foreground: "#20252d",
  foregroundMuted: "#606b78", accent: "#4f46e5", accentForeground: "#ffffff", statusSuccess: "#15803d", statusWarning: "#a16207", statusDanger: "#b91c1c",
} : {
  surface0: "#11151b", surface1: "#1a2029", surface2: "#252d38", border: "#394352", foreground: "#eef1f6",
  foregroundMuted: "#a2adbc", accent: "#a5b4fc", accentForeground: "#14192c", statusSuccess: "#6ee7a0", statusWarning: "#facc6b", statusDanger: "#fda4af",
};
// Every contributed component mounts here, not just the surface: `?workspace`,
// `?agent` and `?pill` pick the panel; the plugin.tsx fixtures hand each one
// an empty first render and then data, the sequence the live host produces.
function Preview() {
  const [compact, setCompact] = useState(innerWidth < 640);
  useEffect(() => { const resize = () => setCompact(innerWidth < 640); addEventListener("resize", resize); return () => removeEventListener("resize", resize); }, []);
  const props = { theme: { colors }, host: { id: "preview", label: "My laptop" }, layout: { compact, platform: "web" as const } };
  const navigation = { openAgent: ({ agentId }: { agentId: string }) => console.info("[open-agent]", agentId), openWorkspace: ({ workspaceId }: { workspaceId: string }) => console.info("[open-workspace]", workspaceId) };
  const agentId = params.get("agent") || "agent-1";
  return <QueryClientProvider client={queryClient}>
    {params.has("workspace") ? <RouterWorkspacePanel {...props} context="workspace" workspaceId="ws-1" navigation={navigation} />
      : params.has("agent") ? <RouterAgentPanel {...props} context="agent" workspaceId="ws-1" agentId={agentId} navigation={navigation} />
      : params.has("pill") ? <RoutingPill {...props} workspaceId="ws-1" agentId={agentId} />
      : <AgentLinkSurface {...props} />}
  </QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
