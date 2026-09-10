import React from "react";
import { ScrollView, View } from "react-native";
import { useWorkspace, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Card, Chip, Note, Row, Step } from "./ui";
import { POOL_LABEL, PoolAccounts, useClearHold, useConnectionHealth, useRoutingHealth, type Pool } from "./accounts";

const POOLS: readonly Pool[] = ["claude", "codex"];

function checkedAgo(iso: string | null): string {
  if (!iso) return "not yet checked";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return minutes === 0 ? "checked just now" : `checked ${minutes} min ago`;
}

/**
 * Routing state for a workspace at a glance: whether agents here are routed,
 * which accounts are resting or stuck, and a way to reset backoff. Reachable
 * from Projects and the explorer, where the per-agent panel is not.
 */
export function RouterWorkspacePanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const workspace = useWorkspace(workspaceId, ({ name, projectDisplayName }) => ({ name, projectDisplayName }));
  const [message, setMessage] = React.useState("");
  const routing = useRoutingHealth(20_000);
  const health = useConnectionHealth();
  const clear = useClearHold(setMessage);

  const padding = layout.compact ? 12 : 20;
  const verdict = routing.data ?? null;
  const stuck = verdict?.stuck ?? [];
  const resting = verdict?.pools.reduce((sum, pool) => sum + pool.resting, 0) ?? 0;
  const ready = verdict?.pools.reduce((sum, pool) => sum + pool.ready, 0) ?? 0;
  const routingTone = verdict === null ? "neutral" : !verdict.routerReachable ? "danger" : verdict.routeAgents ? "success" : "neutral";
  const routingLabel =
    verdict === null ? "Reading…" : !verdict.routerReachable ? "9Router offline" : verdict.routeAgents ? "Agents routed" : "Agents direct";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding }}>
      <Card theme={theme}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Step theme={theme} index={0} title={workspace?.name ?? "This workspace"} />
          <Chip theme={theme} label={routingLabel} tone={routingTone} />
        </View>
        {workspace?.projectDisplayName && workspace.projectDisplayName !== workspace.name ? (
          <Row theme={theme} label="Project" value={workspace.projectDisplayName} />
        ) : null}
        <Row
          theme={theme}
          label="Per-agent routing"
          value={verdict === null ? "…" : verdict.routeAgents ? "on" : "off"}
          tone={verdict?.routeAgents ? "success" : undefined}
        />
        <Row
          theme={theme}
          label="Accounts"
          value={verdict === null ? "…" : !verdict.routerReachable ? "unreachable" : `${ready} ready · ${resting} resting · ${stuck.length} stuck`}
          tone={stuck.length > 0 || (verdict?.routerReachable && ready === 0) ? "danger" : resting > 0 ? "warning" : undefined}
        />
        <Row
          theme={theme}
          label="Background checks"
          value={verdict === null ? "…" : verdict.healthChecks ? `on · ${checkedAgo(verdict.checkedAt)}` : `off · ${checkedAgo(verdict.checkedAt)}`}
        />
        <Note theme={theme}>
          {verdict?.routeAgents
            ? "New Claude sessions in this workspace get 9router's URL and key in their environment. Codex sessions are never touched."
            : "Agents here talk to their providers directly. Turn on \"Route Paseo agents through 9router\" in Settings > Plugins > 9Router > Routing to send new Claude sessions through the pool."}
        </Note>
      </Card>

      {stuck.length > 0 ? (
        <Card theme={theme}>
          <Step theme={theme} index={0} title="Stuck accounts" hint={`${stuck.length}`} />
          <Note theme={theme} tone="warning">
            {stuck.length === 1 ? "This account is" : "These accounts are"} active but backed off past the point 9router retries them, so the pool is serving from fewer accounts than it shows. Reset backoff below to put them back to work.
          </Note>
          {stuck.map((account) => (
            <Row
              theme={theme}
              key={account.id}
              label={`${account.label} (${POOL_LABEL[account.provider as Pool] ?? account.provider})`}
              value={`backoff ${account.backoffLevel}${account.lastError ? ` · ${account.lastError}` : ""}`}
              tone="danger"
            />
          ))}
        </Card>
      ) : null}

      {POOLS.map((pool) => (
        <Card theme={theme} key={pool}>
          <PoolAccounts theme={theme} pool={pool} model={null} health={health} clear={clear} />
        </Card>
      ))}
      {message ? (
        <Card theme={theme}>
          <Note theme={theme}>{message}</Note>
        </Card>
      ) : null}
    </ScrollView>
  );
}
