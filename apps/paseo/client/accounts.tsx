import React from "react";
import { Text, View } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import type { PluginTheme } from "@getpaseo/plugin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routerClearHold, routerConnectionHealth, routerHolds, routerRoutingHealth, type ConnectionHealth } from "../shared/contracts";
import { agentRouting, STUCK_BACKOFF_LEVEL, type AgentRouting } from "../shared/routing-logic";
import { Button, Chip, Note, Step } from "./ui";

/** Paseo's provider id for routed sessions; mirrors PROVIDER_ID on the server. */
export const ROUTER_PROVIDER_ID = "ninerouter";

export const POOL_LABEL = { claude: "Claude", codex: "Codex" } as const;
export type Pool = keyof typeof POOL_LABEL;

export const HEALTH_QUERY_KEY = ["agent-link-9router", "connection-health"] as const;
export const HOLDS_QUERY_KEY = ["agent-link-9router", "holds"] as const;
export const ROUTING_HEALTH_QUERY_KEY = ["agent-link-9router", "routing-health"] as const;

/** Days of host-wide spend the Usage tab's "last day" card shows; 9router has no per-workspace view of it. */
export const HOST_SPEND_DAYS = 1;

/** Tokens and requests as short figures; a card has no room for nine digits. */
export function compactNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(Math.round(value));
}

/** The routed/direct verdict for one agent, judged the same way on every surface. */
export function routingFor(agent: { provider: string; model: string | null }): AgentRouting {
  return agentRouting(agent.provider, agent.model, ROUTER_PROVIDER_ID);
}

export function RoutingChip({ theme, routing }: { theme: PluginTheme; routing: AgentRouting }) {
  return <Chip theme={theme} label={routing.label} tone={routing.verdict === "routed" ? "success" : "neutral"} />;
}

/** Live account health, read by the agent panel. */
export function useConnectionHealth() {
  const callHealth = useRpc(routerConnectionHealth);
  return useQuery({ queryKey: HEALTH_QUERY_KEY, queryFn: () => callHealth({}), refetchInterval: 20_000 });
}

export function useHolds() {
  const callHolds = useRpc(routerHolds);
  return useQuery({ queryKey: HOLDS_QUERY_KEY, queryFn: () => callHolds({}), refetchInterval: 30_000 });
}

/** The server's cached verdict: cheap, so it can be polled from every composer. */
export function useRoutingHealth(refetchInterval = 30_000) {
  const callRoutingHealth = useRpc(routerRoutingHealth);
  return useQuery({ queryKey: ROUTING_HEALTH_QUERY_KEY, queryFn: () => callRoutingHealth({}), refetchInterval });
}

/** Reset backoff on one account and refresh everything that shows accounts. */
export function useClearHold(onMessage: (message: string) => void) {
  const queryClient = useQueryClient();
  const callClearHold = useRpc(routerClearHold);
  return useMutation({
    mutationFn: callClearHold,
    onSuccess: (result) => {
      onMessage(result.message);
      void queryClient.invalidateQueries({ queryKey: ["agent-link-9router"] });
    },
    onError: (error: unknown) => onMessage(error instanceof Error ? error.message : String(error)),
  });
}

export function accountLabel(connection: Pick<ConnectionHealth, "id" | "email" | "name">): string {
  return connection.email || connection.name || connection.id.slice(0, 8);
}

/** One account row: who it is, its state, and a Reset backoff button when it is resting. */
export function AccountRow({
  theme,
  connection,
  model,
  pool,
  clear,
}: {
  theme: PluginTheme;
  connection: ConnectionHealth;
  /** The model being judged against locks; null judges the pool as a whole. */
  model: string | null;
  pool: Pool;
  clear: ReturnType<typeof useClearHold>;
}) {
  const locked = connection.modelLocks.length > 0 && model !== null && !connection.modelLocks.includes(model);
  const stuck = connection.isActive && connection.backoffLevel >= STUCK_BACKOFF_LEVEL;
  const tone = !connection.isActive ? "neutral" : stuck ? "danger" : connection.backoffLevel > 0 ? "warning" : locked ? "warning" : "success";
  const label = !connection.isActive
    ? "inactive"
    : stuck
      ? `stuck · backoff ${connection.backoffLevel}`
      : connection.backoffLevel > 0
        ? `backoff ${connection.backoffLevel}`
        : locked
          ? "locked elsewhere"
          : "ready";
  return (
    <View style={{ gap: 6, padding: 8, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600", flex: 1 }}>{accountLabel(connection)}</Text>
        <Chip theme={theme} label={label} tone={tone} />
      </View>
      {connection.lastError ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{connection.lastError}</Text> : null}
      {stuck ? (
        <Text style={{ color: theme.colors.statusDanger, fontSize: 11 }}>
          9router has given up on this account but still counts it as active, so the pool looks healthier than it is.
        </Text>
      ) : null}
      {connection.backoffLevel > 0 ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Button
            theme={theme}
            label="Reset backoff"
            busy={clear.isPending && clear.variables?.connectionId === connection.id}
            disabled={clear.isPending}
            onPress={() => clear.mutate({ provider: pool, model: model ?? "", connectionId: connection.id })}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The accounts of one pool with their state, loading and error notes, and a reset-all button. */
export function PoolAccounts({
  theme,
  pool,
  model,
  health,
  clear,
}: {
  theme: PluginTheme;
  pool: Pool;
  model: string | null;
  health: ReturnType<typeof useConnectionHealth>;
  clear: ReturnType<typeof useClearHold>;
}) {
  const accounts = (health.data?.connections ?? []).filter((entry) => entry.provider === pool);
  const resting = accounts.filter((entry) => entry.isActive && entry.backoffLevel > 0);
  const usable = accounts.filter((entry) => entry.isActive && entry.backoffLevel === 0).length;
  return (
    <>
      <Step theme={theme} index={0} title={`${POOL_LABEL[pool]} accounts`} hint={`${usable} ready · ${resting.length} resting`} />
      {health.isLoading ? <Note theme={theme}>Reading account health…</Note> : null}
      {health.isError ? <Note theme={theme} tone="warning">Could not reach 9router. Is it running on this host?</Note> : null}
      {!health.isLoading && !health.isError && accounts.length === 0 ? (
        <Note theme={theme}>No {POOL_LABEL[pool]} accounts are connected to 9router. Add one under Accounts in the 9Router sidebar entry.</Note>
      ) : null}
      {accounts.map((connection) => (
        <AccountRow key={connection.id} theme={theme} connection={connection} model={model} pool={pool} clear={clear} />
      ))}
      {resting.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Button
            theme={theme}
            label={`Reset all ${resting.length} ${POOL_LABEL[pool]} accounts`}
            tone="primary"
            busy={clear.isPending}
            disabled={clear.isPending}
            onPress={() => {
              for (const connection of resting) clear.mutate({ provider: pool, model: model ?? "", connectionId: connection.id });
            }}
          />
        </View>
      ) : null}
    </>
  );
}
