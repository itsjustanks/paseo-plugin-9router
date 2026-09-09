import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AgentLinkSurface } from "./client/surface";
import { RoutingSettingsScreen } from "./client/settings";
import { ROUTING_SETTINGS_ID } from "./shared/settings";

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
  client.addSettingsScreen({
    id: ROUTING_SETTINGS_ID,
    title: "Routing",
    icon: "Route",
    Component: RoutingSettingsScreen,
  });
  client.addCommandCenterItem({
    id: "configure-routing",
    title: "Configure 9Router routing",
    icon: "Route",
    keywords: ["9router", "routing", "backoff", "rate limit", "retry", "settings"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings(ROUTING_SETTINGS_ID);
    },
  });
  return () => {};
}
