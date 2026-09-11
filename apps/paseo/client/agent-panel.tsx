import React from "react";
import { ScrollView, View } from "react-native";
import { useAgent, type PluginAgentPanelProps } from "@getpaseo/plugin/client";
import { providerLabel } from "../shared/router-logic";
import { Card, Note, Row, Step } from "./ui";
import { POOL_LABEL, PoolAccounts, RoutingChip, routingFor, useClearHold, useConnectionHealth, useHolds } from "./accounts";
import { AgentUsageCard } from "./usage";

export function RouterAgentPanel({ theme, layout, agentId }: PluginAgentPanelProps) {
  const agent = useAgent(agentId, ({ provider, model, status }) => ({ provider, model, status }));
  const [message, setMessage] = React.useState("");
  const health = useConnectionHealth();
  const holds = useHolds();
  const clear = useClearHold(setMessage);

  const padding = layout.compact ? 12 : 20;
  if (!agent) {
    return (
      <View style={{ flex: 1, padding, backgroundColor: theme.colors.surface0 }}>
        <Note theme={theme}>This agent is not available.</Note>
      </View>
    );
  }

  const routing = routingFor(agent);
  const { routed, pool } = routing;
  const holdsForModel = (holds.data?.holds ?? []).filter((hold) => agent.model !== null && hold.model === agent.model);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding }}>
      <Card theme={theme}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Step theme={theme} index={0} title="This agent" />
          <RoutingChip theme={theme} routing={routing} />
        </View>
        <Row theme={theme} label="Provider" value={routed ? "9Router" : providerLabel(agent.provider)} />
        <Row theme={theme} label="Model" value={agent.model ?? "not set"} />
        <Row theme={theme} label="Status" value={agent.status} tone={agent.status === "error" ? "danger" : agent.status === "running" ? "success" : undefined} />
        <Note theme={theme}>
          {routed
            ? `Requests go through the ${pool ? POOL_LABEL[pool] : "router"} account pool. The accounts below decide whether this model answers.`
            : pool
              ? `This session talks to ${providerLabel(agent.provider)} directly. Turn on "Route Paseo agents through 9router" in Settings > Plugins > 9Router > Routing to send new Claude sessions through the pool.`
              : "This provider is not served by 9router."}
        </Note>
      </Card>

      {/* Per-agent tokens and estimated cost from this agent's own transcript: the one
          figure 9router cannot produce, since its usage rows carry no agent or session. */}
      <AgentUsageCard theme={theme} agentId={agentId} provider={agent.provider} />

      {pool ? (
        <Card theme={theme}>
          <PoolAccounts theme={theme} pool={pool} model={agent.model} health={health} clear={clear} />
          {holdsForModel.length > 0 ? (
            <Note theme={theme} tone="warning">
              {holdsForModel.length} account{holdsForModel.length === 1 ? " is" : "s are"} parked for {agent.model}
              {holdsForModel[0].until ? ` until ${new Date(holdsForModel[0].until).toLocaleTimeString()}` : ""}. Reset backoff above to release them.
            </Note>
          ) : null}
          {message ? <Note theme={theme}>{message}</Note> : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}
