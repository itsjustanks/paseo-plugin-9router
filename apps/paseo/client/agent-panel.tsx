import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useAgent, useRpc, type PluginAgentPanelProps } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routerClearHold, routerConnectionHealth, routerHolds } from "../shared/contracts";
import { poolForAgent } from "../shared/routing-logic";
import { providerLabel } from "../shared/router-logic";
import { Button, Card, Chip, Note, Row, Step } from "./ui";

/** Paseo's provider id for routed sessions; mirrors PROVIDER_ID on the server. */
const ROUTER_PROVIDER_ID = "ninerouter";

const POOL_LABEL = { claude: "Claude", codex: "Codex" } as const;

export function RouterAgentPanel({ theme, layout, agentId }: PluginAgentPanelProps) {
  const queryClient = useQueryClient();
  const agent = useAgent(agentId, ({ provider, model, status }) => ({ provider, model, status }));
  const callHealth = useRpc(routerConnectionHealth);
  const callHolds = useRpc(routerHolds);
  const callClearHold = useRpc(routerClearHold);
  const [message, setMessage] = React.useState("");

  const health = useQuery({
    queryKey: ["agent-link-9router", "connection-health"],
    queryFn: () => callHealth({}),
    refetchInterval: 20_000,
  });
  const holds = useQuery({
    queryKey: ["agent-link-9router", "holds"],
    queryFn: () => callHolds({}),
    refetchInterval: 30_000,
  });
  const clear = useMutation({
    mutationFn: callClearHold,
    onSuccess: (result) => {
      setMessage(result.message);
      void queryClient.invalidateQueries({ queryKey: ["agent-link-9router"] });
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
  });

  const padding = layout.compact ? 12 : 20;
  if (!agent) {
    return (
      <View style={{ flex: 1, padding, backgroundColor: theme.colors.surface0 }}>
        <Note theme={theme}>This agent is not available.</Note>
      </View>
    );
  }

  const routed = agent.provider === ROUTER_PROVIDER_ID;
  const pool = poolForAgent(agent.provider, agent.model, ROUTER_PROVIDER_ID);
  const accounts = (health.data?.connections ?? []).filter((entry) => pool !== null && entry.provider === pool);
  const holdsForModel = (holds.data?.holds ?? []).filter((hold) => agent.model !== null && hold.model === agent.model);
  const resting = accounts.filter((entry) => entry.isActive && entry.backoffLevel > 0).length;
  const usable = accounts.filter((entry) => entry.isActive && entry.backoffLevel === 0).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding }}>
      <Card theme={theme}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Step theme={theme} index={0} title="This agent" />
          <Chip theme={theme} label={routed ? "Via 9Router" : "Direct provider"} tone={routed ? "success" : "neutral"} />
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

      {pool ? (
        <Card theme={theme}>
          <Step theme={theme} index={0} title={`${POOL_LABEL[pool]} accounts`} hint={`${usable} ready · ${resting} resting`} />
          {health.isLoading ? <Note theme={theme}>Reading account health…</Note> : null}
          {health.isError ? <Note theme={theme} tone="warning">Could not reach 9router. Is it running on this host?</Note> : null}
          {!health.isLoading && !health.isError && accounts.length === 0 ? (
            <Note theme={theme}>No {POOL_LABEL[pool]} accounts are connected to 9router. Add one under Accounts in the 9Router sidebar entry.</Note>
          ) : null}
          {accounts.map((connection) => {
            const locked = connection.modelLocks.length > 0 && agent.model !== null && !connection.modelLocks.includes(agent.model);
            const tone = !connection.isActive ? "neutral" : connection.backoffLevel > 0 ? "warning" : locked ? "warning" : "success";
            const label = !connection.isActive ? "inactive" : connection.backoffLevel > 0 ? `backoff ${connection.backoffLevel}` : locked ? "locked elsewhere" : "ready";
            return (
              <View key={connection.id} style={{ gap: 6, padding: 8, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600", flex: 1 }}>
                    {connection.email || connection.name || connection.id.slice(0, 8)}
                  </Text>
                  <Chip theme={theme} label={label} tone={tone} />
                </View>
                {connection.lastError ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{connection.lastError}</Text> : null}
                {connection.backoffLevel > 0 ? (
                  <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                    <Button
                      theme={theme}
                      label="Reset backoff"
                      busy={clear.isPending && clear.variables?.connectionId === connection.id}
                      disabled={clear.isPending}
                      onPress={() => clear.mutate({ provider: pool, model: agent.model ?? "", connectionId: connection.id })}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
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
