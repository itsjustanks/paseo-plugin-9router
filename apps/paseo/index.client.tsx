import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AgentLinkSurface } from "./client/surface";

export default function contribute(client: PluginClientContext) {
  client.addSurface("agent-link", AgentLinkSurface);
  client.addSidebarItem({ id: "agent-link", title: "9Router", icon: "Users", surface: "agent-link" });
  client.addCommandCenterItem({
    id: "open-agent-link",
    title: "Open 9Router Agent Link (accounts, quotas & models)",
    icon: "Users",
    keywords: ["9router", "accounts", "quota", "models", "router", "agent-link"],
    context: "global",
    onSelect({ openSurface }) {
      openSurface("agent-link");
    },
  });
  return () => {};
}
