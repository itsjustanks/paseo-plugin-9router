import React from "react";
import { ScrollView, View } from "react-native";
import { usePaseo, useWorkspace, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { workspaceRoutingSummary } from "../shared/routing-logic";
import { Card, Chip, Note, Row, Step } from "./ui";
import {
  AgentRoutingRow,
  HOST_SPEND_DAYS,
  POOL_LABEL,
  PoolAccounts,
  ROUTER_PROVIDER_ID,
  checkedAgo,
  compactNumber,
  useClearHold,
  useConnectionHealth,
  useHostSpend,
  useRoutingHealth,
  type Pool,
} from "./accounts";

const POOLS: readonly Pool[] = ["claude", "codex"];

type WorkspaceAgent = { id: string; title: string | null; provider: string; model: string | null; status: string };

/** More than any one workspace holds; the daemon pages past it and the panel keeps the first page. */
const AGENT_PAGE_LIMIT = 100;

/**
 * The live agents of one workspace. `useAgent` needs an id, and the panel has
 * none, so this lists once through the Paseo API and then follows the same
 * agent_update stream the pill entry uses to keep the list current.
 */
function useWorkspaceAgents(workspaceId: string): WorkspaceAgent[] | null {
  const paseo = usePaseo();
  const [agents, setAgents] = React.useState<Map<string, WorkspaceAgent> | null>(null);

  React.useEffect(() => {
    let stopped = false;
    const pick = (agent: { id: string; title: string | null; provider: string; model: string | null; status: string }): WorkspaceAgent => ({
      id: agent.id,
      title: agent.title,
      provider: agent.provider,
      model: agent.model,
      status: agent.status,
    });
    setAgents(null);
    const unsubscribe = paseo.agents.subscribe((update) => {
      if (stopped) return;
      setAgents((current) => {
        const next = new Map(current ?? []);
        if (update.kind === "remove") {
          next.delete(update.agentId);
          return next;
        }
        if (update.kind !== "upsert") return current;
        const { agent } = update;
        // An agent that moved workspaces or closed leaves this list; anything else here is kept current.
        if (agent.workspaceId !== workspaceId || agent.status === "closed") {
          next.delete(agent.id);
          return next;
        }
        next.set(agent.id, pick(agent));
        return next;
      });
    });
    paseo.agents
      .list({ scope: "active", page: { limit: AGENT_PAGE_LIMIT } })
      .then((result) => {
        if (stopped) return;
        setAgents((current) => {
          const next = new Map(current ?? []);
          // The list wraps each agent with its project; the stream sends the agent bare.
          for (const { agent } of result.entries) {
            if (agent.workspaceId === workspaceId && agent.status !== "closed") next.set(agent.id, pick(agent));
          }
          return next;
        });
      })
      .catch(() => {
        // The stream still fills the list as agents change; an empty list reads as "no agents" until then.
        if (!stopped) setAgents((current) => current ?? new Map());
      });
    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [paseo, workspaceId]);

  return React.useMemo(() => {
    if (!agents) return null;
    return [...agents.values()].sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id));
  }, [agents]);
}

/**
 * What 9router means for the workspace you are standing in. Accounts, quotas
 * and backoff are host-wide — one router serves every workspace — so the only
 * facts that are truly this workspace's are its agents and how each one
 * reaches a model. Those lead. The account pools follow, marked as the whole
 * host's, because Reset backoff lives there and a stuck account hurts this
 * workspace as much as any other.
 */
export function RouterWorkspacePanel({ theme, layout, workspaceId, navigation }: PluginWorkspacePanelProps) {
  const workspace = useWorkspace(workspaceId, ({ name, projectDisplayName }) => ({ name, projectDisplayName }));
  const agents = useWorkspaceAgents(workspaceId);
  const [message, setMessage] = React.useState("");
  const routing = useRoutingHealth(20_000);
  const health = useConnectionHealth();
  const spend = useHostSpend();
  const clear = useClearHold(setMessage);

  const padding = layout.compact ? 12 : 20;
  const verdict = routing.data ?? null;
  const summary = workspaceRoutingSummary(agents ?? [], ROUTER_PROVIDER_ID);
  // Pools this workspace actually draws from come first; the rest are still reachable below.
  const poolOrder = [...summary.pools, ...POOLS.filter((pool) => !summary.pools.includes(pool))];
  const stuck = verdict?.stuck ?? [];
  const stuckHere = stuck.filter((account) => summary.pools.includes(account.provider as Pool));
  const routingTone = verdict === null ? "neutral" : !verdict.routerReachable ? "danger" : summary.routed > 0 ? "success" : "neutral";
  const routingLabel =
    verdict === null
      ? "Reading…"
      : !verdict.routerReachable
        ? "9Router offline"
        : agents === null
          ? "Listing agents…"
          : summary.agents === 0
            ? "No agents"
            : `${summary.routed} of ${summary.agents} routed`;
  const totals = spend.data?.ok ? spend.data.totals : null;

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
          label="Agents here"
          value={agents === null ? "…" : `${summary.routed} via 9Router · ${summary.direct} direct${summary.unserved > 0 ? ` · ${summary.unserved} other` : ""}`}
        />
        <Row
          theme={theme}
          label="Pools in use"
          value={agents === null ? "…" : summary.pools.length === 0 ? "none" : summary.pools.map((pool) => POOL_LABEL[pool]).join(" + ")}
        />
        {agents === null ? <Note theme={theme}>Listing this workspace's agents…</Note> : null}
        {agents !== null && agents.length === 0 ? (
          <Note theme={theme}>No agents are open in this workspace. Start one and pick the 9Router provider to route it through the pool.</Note>
        ) : null}
        {agents?.map((agent) => (
          <AgentRoutingRow
            key={agent.id}
            theme={theme}
            agent={agent}
            onPress={navigation ? () => navigation.openAgent({ agentId: agent.id }) : undefined}
          />
        ))}
        <Note theme={theme}>
          {verdict?.routeAgents
            ? "Per-agent routing is on: Claude sessions opened since then also carry 9router's URL and key in their environment. That injection is not visible from here, so a Claude agent above reads as direct even when its traffic goes through the router. Codex sessions are never touched."
            : "Routed means the agent runs on the 9Router provider. Direct agents talk to Claude or Codex themselves; turn on \"Route Paseo agents through 9router\" in Settings > Plugins > 9Router > Routing to send new Claude sessions through the pool."}
        </Note>
        {stuckHere.length > 0 ? (
          <Note theme={theme} tone="warning">
            {stuckHere.length === 1 ? "1 account this workspace depends on is" : `${stuckHere.length} accounts this workspace depends on are`} stuck in backoff. Reset {stuckHere.length === 1 ? "it" : "them"} under Host accounts below.
          </Note>
        ) : null}
      </Card>

      <Card theme={theme}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Step theme={theme} index={0} title="Host-wide usage" hint={totals ? totals.label : `last ${HOST_SPEND_DAYS}d`} />
          <Chip theme={theme} label="whole host" tone="neutral" />
        </View>
        {spend.isLoading ? <Note theme={theme}>Reading 9router usage…</Note> : null}
        {spend.data && !spend.data.ok ? <Note theme={theme} tone="warning">{spend.data.message ?? "9router did not return usage."}</Note> : null}
        {totals ? (
          <>
            <Row theme={theme} label="Requests" value={compactNumber(totals.requests)} />
            <Row theme={theme} label="Tokens in / out" value={`${compactNumber(totals.promptTokens)} / ${compactNumber(totals.completionTokens)}`} />
            <Row theme={theme} label="API-equivalent cost" value={`$${totals.cost.toFixed(2)}`} />
          </>
        ) : null}
        <Note theme={theme}>
          These figures are for every workspace on this host, not this one. 9router records provider, model, account and API key per request, and every Paseo session shares one key, so no request can be tied back to a workspace.
        </Note>
      </Card>

      <Card theme={theme}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Step theme={theme} index={0} title="Host accounts" hint={verdict === null ? "" : verdict.healthChecks ? checkedAgo(verdict.checkedAt) : `checks off · ${checkedAgo(verdict.checkedAt)}`} />
          <Chip theme={theme} label="whole host" tone="neutral" />
        </View>
        <Note theme={theme}>
          One 9router serves every workspace, so these accounts and their backoff are shared. Resetting backoff here affects all of them.
        </Note>
        {stuck.length > 0 ? (
          <>
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
          </>
        ) : null}
      </Card>

      {poolOrder.map((pool) => (
        <Card theme={theme} key={pool}>
          <PoolAccounts theme={theme} pool={pool} model={null} health={health} clear={clear} />
          {!summary.pools.includes(pool) && agents !== null ? (
            <Note theme={theme}>No agent in this workspace draws from the {POOL_LABEL[pool]} pool right now.</Note>
          ) : null}
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
