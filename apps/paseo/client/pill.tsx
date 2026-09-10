import React from "react";
import { Text } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useAgent, type PluginClientContext, type PluginComposerPillProps } from "@getpaseo/plugin/client";
import { pillDecision, poolForAgent, type PillDecision } from "../shared/routing-logic";
import { routerRoutingHealth } from "../shared/contracts";
import { ROUTER_PROVIDER_ID, useRoutingHealth } from "./accounts";

/** The plugin-local pill id; one per agent composer. */
export const ROUTING_PILL_ID = "routing-health";

/** Pick the server-cached verdict apart for one agent. */
export function useRoutingPillDecision(agentId: string): PillDecision {
  const agent = useAgent(agentId, ({ provider, model }) => ({ provider, model }));
  const routing = useRoutingHealth();
  const data = routing.data;
  if (!agent || !data) return { show: false, label: "", tone: "neutral" };
  const pool = poolForAgent(agent.provider, agent.model, ROUTER_PROVIDER_ID);
  return pillDecision({
    settings: { routeAgents: data.routeAgents, showComposerPill: data.showComposerPill },
    verdict: pool ? (data.pools.find((entry) => entry.pool === pool) ?? null) : null,
    routerReachable: data.routerReachable,
    routed: agent.provider === ROUTER_PROVIDER_ID,
    pool,
  });
}

/**
 * Paseo owns the pill chrome; this only renders icon and text. The entry adds
 * the pill only when there is something to act on, so this normally has a
 * label; between the verdict clearing and the next sync it falls back to a
 * neutral "9Router" rather than claiming a problem that is gone.
 */
export function RoutingPill({ theme, agentId }: PluginComposerPillProps) {
  const decision = useRoutingPillDecision(agentId);
  const color =
    decision.tone === "danger" ? theme.colors.statusDanger : decision.tone === "warning" ? theme.colors.statusWarning : theme.colors.foregroundMuted;
  return (
    <>
      <Icon name={decision.tone === "danger" ? "TriangleAlert" : "Route"} size={14} color={color} />
      <Text numberOfLines={1} style={{ color, flexShrink: 1 }}>
        {decision.show ? `9Router · ${decision.label}` : "9Router"}
      </Text>
    </>
  );
}

/** How often the entry re-reads the server cache to add or drop pills. The cache itself is cheap. */
const PILL_SYNC_MS = 30_000;

type LiveAgent = { workspaceId: string; provider: string; model: string | null };

/**
 * Pills following the SDK's composer-pill pattern: subscribe to agent upserts,
 * keep a remover per agent, drop everything on cleanup. The twist is that a
 * pill only exists while the cached verdict says there is something to act on
 * for that agent's pool; a healthy composer gets no chip at all. The entry
 * re-reads the server cache on a timer and adds or removes pills to match.
 * Pressing a pill opens the 9Router surface: the accounts page is where
 * backoff is reset, and it works from any workspace without the agent's tab.
 */
export function registerRoutingPills(client: PluginClientContext): () => void {
  const agents = new Map<string, LiveAgent>();
  const pills = new Map<string, () => void>();
  let stopped = false;

  const removePill = (agentId: string) => {
    pills.get(agentId)?.();
    pills.delete(agentId);
  };

  const sync = async () => {
    if (stopped || agents.size === 0) return;
    // Keep whatever pills exist when the daemon cannot answer; the next tick judges again.
    const data = await client.rpc(routerRoutingHealth, {}).catch(() => null);
    if (stopped || !data) return;
    for (const [agentId, agent] of agents) {
      const pool = poolForAgent(agent.provider, agent.model, ROUTER_PROVIDER_ID);
      const decision = pillDecision({
        settings: { routeAgents: data.routeAgents, showComposerPill: data.showComposerPill },
        verdict: pool ? (data.pools.find((entry) => entry.pool === pool) ?? null) : null,
        routerReachable: data.routerReachable,
        routed: agent.provider === ROUTER_PROVIDER_ID,
        pool,
      });
      if (!decision.show) {
        removePill(agentId);
        continue;
      }
      if (pills.has(agentId)) continue;
      pills.set(
        agentId,
        client.addComposerPill({
          id: ROUTING_PILL_ID,
          title: "Open 9Router accounts",
          workspaceId: agent.workspaceId,
          agentId,
          Component: RoutingPill,
          onPress() {
            client.openSurface("agent-link");
          },
        }),
      );
    }
  };

  const unsubscribe = client.paseo.agents.subscribe((update) => {
    if (update.kind === "remove") {
      agents.delete(update.agentId);
      removePill(update.agentId);
      return;
    }
    if (update.kind !== "upsert" || !update.agent.workspaceId) return;
    const { id, workspaceId, provider, model, status } = update.agent;
    if (status === "closed") {
      agents.delete(id);
      removePill(id);
      return;
    }
    const known = agents.get(id);
    agents.set(id, { workspaceId, provider, model });
    // A new agent, or one whose provider/model changed, is judged right away.
    if (!known || known.provider !== provider || known.model !== model || known.workspaceId !== workspaceId) {
      if (known && known.workspaceId !== workspaceId) removePill(id);
      void sync();
    }
  });
  const timer = setInterval(() => void sync(), PILL_SYNC_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
    unsubscribe();
    for (const remove of pills.values()) remove();
    pills.clear();
    agents.clear();
  };
}
