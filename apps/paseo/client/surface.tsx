import { Modal } from "@getpaseo/plugin/client/react-native";
import { Card, Step, Chip, Button, Field, Note, QuotaBar, SpendRow, Toggle, Row } from "./ui";
import { Navigation, Overview, Guide, SectionHeading, type TabId } from "./navigation";
import { ModelCatalog } from "./catalog";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Clipboard, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { CliHijack, Connection, RouterStatus } from "../shared/contracts";
import {
  routerAliasRemove,
  routerAliasSet,
  routerConnectComplete,
  routerConnectPoll,
  routerConnectStart,
  routerConnectionRemove,
  routerModelExpose,
  routerAddAstra,
  routerRouteCli,
  routerSettingsSave,
  routerStart,
  routerStatus,
  routerSyncModels,
  routerUsageStats,
  routerCatalogSync,
  routerConnectionHealth,
  routerRequestLogs,
  routerConnectionOrder,
  routerConnectionPrioritySet,
  routerConnectionActiveSet,
  routerModelAvailability,
  routerSpend,
  routerCliTools,
  routerProxyPools,
  routerPxpipe,
  routerStrategies,
  routerStrategySet,
  routerTailscale,
  routerTailscaleAction,
  routerVersion,
  routerUpdate,
  routerThinkingCheck,
  routerUsageChart,
  routerHealth,
  routerHolds,
  routerClearHold,
  routerDashboardOpen,
  routerTestModel,
  routerTuning,
  routerTuningSet,
  routerLogs,
  routerKeys,
  routerKeyCreate,
  routerKeyDelete,
  routerKeyReveal,
  routerCombos,
  routerComboSave,
  routerComboDelete,
  routerPasswordChange,
  routerPowerUps,
  routerPowerUpApply,
  routerSyncSelection,
  routerSyncSelectionSet,
  routerTunnel,
  routerTunnelSet,
  routerLocalForward,
  routerLocalForwardStatus,
  routerLocalForwardStop,
  routerRequireApiKey,
} from "../shared/contracts";
import { cliForModel, formatReset, groupModelIds, parseOauthPaste, providerLabel, quotaTone } from "../shared/router-logic";
import { stuckConnections } from "../shared/routing-logic";
import { HOST_SPEND_DAYS, compactNumber } from "./accounts";

type Theme = PluginTheme;

// ------------------------------------------------------------- primitives

// ------------------------------------------------------------------ surface

const DEFAULT_PASSWORD = "123456";

/**
 * Durations here are read at a glance, not measured, so precision past the
 * second unit is noise: "2d 4h" answers "has it been stable?" better than
 * "2d 4h 17m 3s".
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** Relative age, for "last seen" style values. */
function formatAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  return `${formatDuration((Date.now() - then) / 1000)} ago`;
}

export function AgentLinkSurface({ theme, layout, host }: PluginSurfaceProps) {
  const queryClient = useQueryClient();
  const callStatus = useRpc(routerStatus);
  const callStart = useRpc(routerStart);
  const callSaveSettings = useRpc(routerSettingsSave);
  const callRouteCli = useRpc(routerRouteCli);
  const callSyncModels = useRpc(routerSyncModels);
  const callConnectStart = useRpc(routerConnectStart);
  const callConnectPoll = useRpc(routerConnectPoll);
  const callConnectComplete = useRpc(routerConnectComplete);
  const callRemoveConnection = useRpc(routerConnectionRemove);
  const callExpose = useRpc(routerModelExpose);
  const callAddAstra = useRpc(routerAddAstra);
  const callAliasSet = useRpc(routerAliasSet);
  const callAliasRemove = useRpc(routerAliasRemove);
  const callUsageStats = useRpc(routerUsageStats);
  const callCatalogSync = useRpc(routerCatalogSync);
  const callConnectionHealth = useRpc(routerConnectionHealth);
  const callRequestLogs = useRpc(routerRequestLogs);
  const callConnectionOrder = useRpc(routerConnectionOrder);
  const callPrioritySet = useRpc(routerConnectionPrioritySet);
  const callActiveSet = useRpc(routerConnectionActiveSet);
  const callAvailability = useRpc(routerModelAvailability);
  const callSpend = useRpc(routerSpend);
  const callCliTools = useRpc(routerCliTools);
  const callProxyPools = useRpc(routerProxyPools);
  const callPxpipe = useRpc(routerPxpipe);
  const callStrategies = useRpc(routerStrategies);
  const callStrategySet = useRpc(routerStrategySet);
  const callTailscale = useRpc(routerTailscale);
  const callTailscaleAction = useRpc(routerTailscaleAction);
  const callVersion = useRpc(routerVersion);
  const callUpdate = useRpc(routerUpdate);
  const callThinkingCheck = useRpc(routerThinkingCheck);
  const callUsageChart = useRpc(routerUsageChart);
  const callHealth = useRpc(routerHealth);
  const callHolds = useRpc(routerHolds);
  const callClearHold = useRpc(routerClearHold);
  const callTestModel = useRpc(routerTestModel);
  const callTuning = useRpc(routerTuning);
  const callTuningSet = useRpc(routerTuningSet);
  const callLogs = useRpc(routerLogs);
  const callKeys = useRpc(routerKeys);
  const callKeyCreate = useRpc(routerKeyCreate);
  const callKeyDelete = useRpc(routerKeyDelete);
  const callKeyReveal = useRpc(routerKeyReveal);
  const callCombos = useRpc(routerCombos);
  const callComboSave = useRpc(routerComboSave);
  const callComboDelete = useRpc(routerComboDelete);
  const callPasswordChange = useRpc(routerPasswordChange);
  const callPowerUps = useRpc(routerPowerUps);
  const callPowerUpApply = useRpc(routerPowerUpApply);
  const callSyncSelection = useRpc(routerSyncSelection);
  const callSyncSelectionSet = useRpc(routerSyncSelectionSet);
  const callTunnel = useRpc(routerTunnel);
  const callTunnelSet = useRpc(routerTunnelSet);
  const callDashboardOpen = useRpc(routerDashboardOpen);
  const callRequireApiKey = useRpc(routerRequireApiKey);
  const callForward = useRpc(routerLocalForward);
  const callForwardStop = useRpc(routerLocalForwardStop);
  const callForwardStatus = useRpc(routerLocalForwardStatus);

  const status = useQuery({
    queryKey: ["agent-link-9router", "router-status"],
    queryFn: () => callStatus({}),
    refetchInterval: 15_000,
  });
  const data = status.data;
  const live = data?.running === true && data.auth.ok;

  const [tab, setTab] = useState<TabId>("overview");
  const [confirmAction, setConfirmAction] = useState<{ title: string; detail: string; run: () => void } | null>(null);
  const [accountView, setAccountView] = useState<"balances" | "health" | "rotation">("balances");
  const [accountQuery, setAccountQuery] = useState("");
  const [message, setMessage] = useState<string>("");
  // 9router ships with this password; prefilling it means Save works immediately
  // on a fresh install, and it is still editable for anyone who changed it.
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [signIn, setSignIn] = useState<{
    provider: "claude" | "codex";
    mode: "paste-code" | "poll";
    authUrl: string;
    state: string;
    codeVerifier: string | null;
    redirectUri: string;
  } | null>(null);
  const [pasted, setPasted] = useState("");
  const [exposeAlias, setExposeAlias] = useState("cc");
  const [exposeId, setExposeId] = useState("");
  const [exposeName, setExposeName] = useState("");
  const [aliasFrom, setAliasFrom] = useState("");
  const [aliasTo, setAliasTo] = useState("");
  const [comboName, setComboName] = useState("");
  const [comboModels, setComboModels] = useState<string[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ model: string; ok: boolean; message: string } | null>(null);

  const availability = useQuery({
    queryKey: ["agent-link-9router", "model-availability"],
    queryFn: () => callAvailability({}),
    enabled: live && ["models", "picker", "custom"].includes(tab),
    refetchInterval: ["models", "picker", "custom"].includes(tab) ? 15_000 : false,
  });
  const order = useQuery({
    queryKey: ["agent-link-9router", "connection-order"],
    queryFn: () => callConnectionOrder({}),
    enabled: live && tab === "accounts",
  });
  // Connection health is what explains a model that will not answer, so it
  // loads with the Accounts tab rather than behind a button.
  const health = useQuery({
    queryKey: ["agent-link-9router", "connection-health"],
    queryFn: () => callConnectionHealth({}),
    enabled: live && tab === "accounts",
    refetchInterval: tab === "accounts" ? 20_000 : false,
  });
  const requestLogs = useQuery({
    queryKey: ["agent-link-9router", "request-logs"],
    queryFn: () => callRequestLogs({ limit: 25, errorsOnly: true }),
    enabled: live && tab === "logs",
    refetchInterval: tab === "logs" ? 8_000 : false,
  });
  const thinking = useQuery({
    queryKey: ["agent-link-9router", "thinking-check"],
    queryFn: () => callThinkingCheck({ model: null }),
    // Manual only: this spends a real request against a live account, so it
    // runs when asked rather than on a timer.
    enabled: false,
    retry: false,
  });
  const tailscale = useQuery({
    queryKey: ["agent-link-9router", "tailscale"],
    queryFn: () => callTailscale({}),
    enabled: live && tab === "setup",
    refetchInterval: tab === "setup" ? 15_000 : false,
  });
  const version = useQuery({
    queryKey: ["agent-link-9router", "version"],
    queryFn: () => callVersion({}),
    enabled: live,
    refetchInterval: 300_000,
  });
  const strategies = useQuery({
    queryKey: ["agent-link-9router", "strategies"],
    queryFn: () => callStrategies({}),
    enabled: live && tab === "accounts",
  });
  const health9 = useQuery({
    queryKey: ["agent-link-9router", "health-summary"],
    queryFn: () => callHealth({}),
    // Runs on every tab: the badge is only useful if it is current when you are
    // looking at something else.
    enabled: live,
    refetchInterval: 45_000,
  });
  const [chartDays, setChartDays] = useState(14);
  const usageChart = useQuery({
    queryKey: ["agent-link-9router", "usage-chart", chartDays],
    queryFn: () => callUsageChart({ days: chartDays }),
    enabled: live && tab === "usage",
    refetchInterval: tab === "usage" ? 60_000 : false,
  });
  const spend = useQuery({
    queryKey: ["agent-link-9router", "spend"],
    queryFn: () => callSpend({ days: null }),
    enabled: live && tab === "usage",
    refetchInterval: tab === "usage" ? 30_000 : false,
  });
  // The last day on its own: "since install" totals cannot say whether today is
  // burning quota. Host-wide by necessity; nothing in 9router's usage records
  // ties a request to a workspace.
  const lastDay = useQuery({
    queryKey: ["agent-link-9router", "spend", "last-day"],
    queryFn: () => callSpend({ days: HOST_SPEND_DAYS }),
    enabled: live && tab === "usage",
    refetchInterval: tab === "usage" ? 60_000 : false,
  });
  const cliTools = useQuery({
    queryKey: ["agent-link-9router", "cli-tools"],
    queryFn: () => callCliTools({}),
    enabled: live && tab === "routing",
    refetchInterval: tab === "routing" ? 20_000 : false,
  });
  const proxyPools = useQuery({
    queryKey: ["agent-link-9router", "proxy-pools"],
    queryFn: () => callProxyPools({}),
    enabled: live && tab === "routing",
  });
  const pxpipe = useQuery({
    queryKey: ["agent-link-9router", "pxpipe"],
    queryFn: () => callPxpipe({}),
    enabled: live && tab === "routing",
    refetchInterval: tab === "routing" ? 20_000 : false,
  });
  const usage = useQuery({
    queryKey: ["agent-link-9router", "usage-stats"],
    queryFn: () => callUsageStats({}),
    enabled: live && tab === "usage",
    refetchInterval: 30_000,
  });
  const tuning = useQuery({
    queryKey: ["agent-link-9router", "tuning"],
    queryFn: () => callTuning({}),
    enabled: live && tab === "tuning",
  });
  const logs = useQuery({
    queryKey: ["agent-link-9router", "logs"],
    queryFn: () => callLogs({ limit: 200 }),
    enabled: live && tab === "logs",
    refetchInterval: tab === "logs" ? 4_000 : false,
  });
  const keys = useQuery({
    queryKey: ["agent-link-9router", "keys"],
    queryFn: () => callKeys({}),
    enabled: live && tab === "keys",
  });
  const combos = useQuery({
    queryKey: ["agent-link-9router", "combos"],
    queryFn: () => callCombos({}),
    enabled: live && (tab === "keys" || ["models", "picker", "custom"].includes(tab)),
  });
  const powerUps = useQuery({
    queryKey: ["agent-link-9router", "power-ups"],
    queryFn: () => callPowerUps({}),
    enabled: tab === "powerups",
  });
  const syncSelection = useQuery({
    queryKey: ["agent-link-9router", "sync-selection"],
    queryFn: () => callSyncSelection({}),
    enabled: ["models", "picker", "custom"].includes(tab),
  });
  const tunnel = useQuery({
    queryKey: ["agent-link-9router", "tunnel"],
    queryFn: () => callTunnel({}),
    // Not gated to one tab: "Copy dashboard link" appears on several, and it needs
    // the tunnel URL to reach a remote router rather than this machine's
    // loopback. Polls fast only on Setup, where a tunnel is actually started.
    enabled: live,
    refetchInterval: tab === "setup" ? 8_000 : 30_000,
  });
  const holds = useQuery({
    queryKey: ["agent-link-9router", "holds"],
    queryFn: () => callHolds({}),
    enabled: live,
    refetchInterval: 30_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["agent-link-9router"] });
  };
  const feedback = {
    onSuccess: (result: { message?: string }) => {
      if (result?.message) setMessage(result.message);
      refresh();
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
  };

  const startMutation = useMutation({ mutationFn: callStart, ...feedback });
  const saveMutation = useMutation({ mutationFn: callSaveSettings, ...feedback });
  const routeMutation = useMutation({ mutationFn: callRouteCli, ...feedback });
  const syncMutation = useMutation({ mutationFn: callSyncModels, ...feedback });
  const catalogSyncMutation = useMutation({ mutationFn: callCatalogSync, ...feedback });
  const priorityMutation = useMutation({ mutationFn: callPrioritySet, ...feedback });
  const strategyMutation = useMutation({ mutationFn: callStrategySet, ...feedback });
  const tailscaleMutation = useMutation({ mutationFn: callTailscaleAction, ...feedback });
  const updateMutation = useMutation({ mutationFn: callUpdate, ...feedback });
  const activeMutation = useMutation({ mutationFn: callActiveSet, ...feedback });
  const removeMutation = useMutation({ mutationFn: callRemoveConnection, ...feedback });
  const exposeMutation = useMutation({ mutationFn: callExpose, ...feedback });
  const addAstraMutation = useMutation({ mutationFn: callAddAstra, ...feedback });
  const aliasSetMutation = useMutation({ mutationFn: callAliasSet, ...feedback });
  const aliasRemoveMutation = useMutation({ mutationFn: callAliasRemove, ...feedback });
  const clearHoldMutation = useMutation({ mutationFn: callClearHold, ...feedback });
  const tuningMutation = useMutation({ mutationFn: callTuningSet, ...feedback });
  const keyCreateMutation = useMutation({ mutationFn: callKeyCreate, ...feedback });
  const keyDeleteMutation = useMutation({ mutationFn: callKeyDelete, ...feedback });
  const comboSaveMutation = useMutation({ mutationFn: callComboSave, ...feedback });
  const comboDeleteMutation = useMutation({ mutationFn: callComboDelete, ...feedback });
  const passwordMutation = useMutation({ mutationFn: callPasswordChange, ...feedback });
  const powerUpMutation = useMutation({ mutationFn: callPowerUpApply, ...feedback });
  const selectionMutation = useMutation({ mutationFn: callSyncSelectionSet, ...feedback });
  const tunnelMutation = useMutation({ mutationFn: callTunnelSet, ...feedback });
  const requireKeyMutation = useMutation({ mutationFn: callRequireApiKey, ...feedback });
  const keyRevealMutation = useMutation({
    mutationFn: callKeyReveal,
    onSuccess: (result) => {
      // The only path that materialises a full key, and it goes straight to the
      // clipboard rather than onto the screen.
      if (result.ok && result.key) Clipboard.setString(result.key);
      setMessage(result.message);
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
  });
  const testMutation = useMutation({
    mutationFn: callTestModel,
    onSuccess: (result, input) => setTestResult({ model: input.model, ok: result.ok, message: result.message }),
    onError: (error: unknown, input) =>
      setTestResult({ model: input.model, ok: false, message: error instanceof Error ? error.message : String(error) }),
  });

  const connectMutation = useMutation({
    mutationFn: (provider: "claude" | "codex") => callConnectStart({ provider }),
    onSuccess: (result) => {
      setSignIn(result);
      setPasted("");
      setMessage("");
      // Deliberately NOT Linking.openURL: inside the app that lands in Paseo's
      // own browser tab, where an OAuth sign-in cannot complete (no cookie jar
      // it can hand back, and the provider often refuses the embedded view).
      // Copying puts the link in a real browser instead, which is the only
      // place the login actually works.
      Clipboard.setString(result.authUrl);
      setMessage("Sign-in link copied — paste it into your normal browser, then bring the code back here.");
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!signIn) throw new Error("No sign-in in progress.");
      if (signIn.mode === "poll") return callConnectPoll({ provider: signIn.provider, state: signIn.state });
      const parsed = parseOauthPaste(pasted);
      if (!parsed) throw new Error("Paste the code (or the full callback URL) from the sign-in page.");
      return callConnectComplete({
        provider: signIn.provider,
        code: parsed.code,
        state: parsed.state ?? signIn.state,
        codeVerifier: signIn.codeVerifier ?? "",
        redirectUri: signIn.redirectUri,
      });
    },
    onSuccess: (result: { ok?: boolean; status?: string; error?: string | null }) => {
      if (result.ok === true || result.status === "done") {
        setSignIn(null);
        setPasted("");
        setMessage("Account connected.");
      } else if (result.status === "pending") {
        setMessage("Waiting for the browser sign-in to finish…");
      } else {
        setMessage(result.error ?? "Sign-in did not complete.");
      }
      refresh();
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
  });

  // The dashboard is bound to the ROUTER's loopback. Opening its URL opens it on
  // whichever machine the app runs on, so for a remote daemon the link reaches
  // this machine's port instead — the wrong router, or nothing. The forward
  // below makes the same URL mean the right thing.
  const forward = useQuery({
    queryKey: ["agent-link-9router", "local-forward"],
    queryFn: () => callForwardStatus({}),
    refetchInterval: 20_000,
  });

  const [forwardHost, setForwardHost] = useState("");
  const [forwardKey, setForwardKey] = useState("");
  const [forwardMinutes, setForwardMinutes] = useState("5");
  const [forwardCountdown, setForwardCountdown] = useState<string | null>(null);

  // Tick locally rather than polling: the expiry is known, and a countdown that
  // only moves every 20s reads as broken.
  const expiresAt = forward.data?.expiresAt ?? null;
  useEffect(() => {
    if (!expiresAt) {
      setForwardCountdown(null);
      return;
    }
    const tick = () => {
      const left = Date.parse(expiresAt) - Date.now();
      if (Number.isNaN(left) || left <= 0) {
        setForwardCountdown("closing…");
        void forward.refetch();
        return;
      }
      const total = Math.round(left / 1000);
      setForwardCountdown(`${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`);
    };
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [expiresAt]);

  // The dashboard is a cookie-signed-in Next.js app. Same reason as the OAuth
  // link above: Linking.openURL lands in Paseo's own browser tab, which has no
  // cookie jar for the router to sign into, so the login page either renders
  // blank or loops. This build exposes no way to escape that tab, so the link
  // goes to the clipboard with the instruction to use a real browser.
  const copyDashboardLink = (target: string, detail: string) => {
    Clipboard.setString(target);
    setMessage(`Dashboard link copied — paste it into your normal browser and sign in there. ${detail}`.trim());
  };

  // The server picks the URL (forward, running tunnel, or loopback) and starts
  // the Cloudflare tunnel itself when nothing is live yet, so one press works
  // from any machine instead of always reaching for 127.0.0.1.
  // Declared before the loading return below: a hook after an early return
  // changes the hook count once status arrives, which React reports as #310.
  const dashboardMutation = useMutation({
    mutationFn: callDashboardOpen,
    onSuccess: (result) => {
      copyDashboardLink(result.url, result.message);
      if (result.source === "tunnel") void tunnel.refetch();
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
  });

  if (status.isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface0, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const gap = layout.compact ? 8 : 12;
  const hijackFor = (cli: "claude" | "codex") => data?.hijack.find((entry) => entry.cli === cli);
  const grouped = groupModelIds(data?.models.ids ?? []);
  const holdCount = holds.data?.count ?? 0;
  // Active accounts 9router has backed off past the point it retries them. They
  // still count as serving slots, so the pool looks healthier than it is.
  const stuck = stuckConnections(health.data?.connections ?? []);
  const lastDayTotals = lastDay.data?.ok ? lastDay.data.totals : null;

  // The setup checklist doubles as the wizard: each step knows whether it is
  // done, so a fresh install reads top-to-bottom and a working one is all ticks.
  const steps = [
    { done: Boolean(data?.binary.path), label: "9router installed" },
    { done: Boolean(data?.running), label: "9router running" },
    { done: Boolean(data?.auth.ok), label: "Dashboard password saved" },
    { done: (data?.connections.length ?? 0) > 0, label: "At least one account connected" },
    { done: data?.paseo.modelsInSync === true, label: "9Router models synced into Paseo" },
  ];
  const remaining = steps.filter((step) => !step.done).length;

  const byProvider = new Map<string, Connection[]>();
  for (const connection of (data?.connections ?? []).filter((c) => `${c.name} ${c.email ?? ""} ${providerLabel(c.provider)}`.toLowerCase().includes(accountQuery.toLowerCase()))) {
    const list = byProvider.get(connection.provider) ?? [];
    list.push(connection);
    byProvider.set(connection.provider, list);
  }

  const openLink = (target: string) => {
    void Linking.openURL(target).catch(() => {
      Clipboard.setString(target);
      setMessage(`Copied ${target}`);
    });
  };

  const dashboardBusy = dashboardMutation.isPending;
  const openDashboard = () => dashboardMutation.mutate({});

  const openForward = () => {
    const host = forwardHost.trim();
    if (!host) {
      setMessage("Enter the daemon's SSH target first, e.g. user@host.");
      return;
    }
    const minutes = Number.parseInt(forwardMinutes, 10);
    void callForward({
      sshTarget: host,
      sshPort: null,
      identityFile: forwardKey.trim() || null,
      remotePort: 20128,
      ttlMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 5,
    })
      .then((result) => {
        setMessage(result.message);
        void forward.refetch();
        if (result.ok && result.url) copyDashboardLink(result.url, result.message);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)));
  };

  const closeForward = () => {
    void callForwardStop({})
      .then((result) => {
        setMessage(result.message);
        void forward.refetch();
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: layout.compact ? 16 : 28, paddingBottom: 48, width: "100%", maxWidth: 1180, alignSelf: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: 24, fontWeight: "700" }}>9Router</Text>
          <Note theme={theme}>Selected host: {host?.label || "This Paseo host"}</Note>
        </View>
        {data?.running ? <Chip theme={theme} label={`v${data.version?.current ?? data.binary.version ?? "unknown"}`} /> : null}
        <Chip theme={theme} label={status.isError ? "Connection unavailable" : live ? "Router connected" : data?.running ? "Sign-in needed" : "Router stopped"} tone={live ? "success" : "warning"} />
      </View>
      <Note theme={theme}>Your accounts, model picker, and request routing in one place. Choose a section to inspect its settings before changing them.</Note>
      <Navigation theme={theme} compact={layout.compact} active={tab} onSelect={setTab} />
      <SectionHeading theme={theme} tab={tab} />
      {status.isError ? <Card theme={theme}><Step theme={theme} index={0} title="Could not read this router" /><Note theme={theme}>Check the selected Paseo host and saved router connection. Existing sessions keep their configuration.</Note><Button theme={theme} label="Retry connection" busy={status.isFetching} onPress={refresh} /></Card> : null}
      <Modal open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }} title={confirmAction?.title ?? "Confirm change"}><Modal.Content>{confirmAction ? <View style={{ backgroundColor: theme.colors.surface1, padding: 20, gap: 14 }}><Note theme={theme} tone="warning">{confirmAction.detail}</Note><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button theme={theme} label="Confirm change" tone="danger" onPress={() => { const run = confirmAction.run; setConfirmAction(null); run(); }} /><Button theme={theme} label="Cancel change" onPress={() => setConfirmAction(null)} /></View></View> : null}</Modal.Content></Modal>
      {tab === "overview" ? <Overview theme={theme} compact={layout.compact} data={data} onSelect={setTab} refresh={refresh} refreshing={status.isFetching} openDashboard={openDashboard} dashboardBusy={dashboardBusy} /> : null}
          {health9.data && ["overview", "usage"].includes(tab) ? (
            <Card theme={theme}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ color: theme.colors.foreground, fontSize: 15, fontWeight: "700", flex: 1 }}>
                  {health9.data.headline}
                </Text>
                <Chip
                  theme={theme}
                  label={health9.data.state}
                  tone={
                    health9.data.state === "ok" ? "success" : health9.data.state === "warn" ? "warning" : "danger"
                  }
                />
              </View>
              <Note theme={theme}>
                Reported account, request, and router checks. Follow the suggested action for a finding; model availability can still change between requests.
              </Note>
              {health9.data.findings.map((finding) => (
                <View key={finding.id} style={{ gap: 2, paddingVertical: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Chip
                      theme={theme}
                      label={finding.severity}
                      tone={
                        finding.severity === "ok" ? "success" : finding.severity === "warn" ? "warning" : "danger"
                      }
                    />
                    <Text style={{ color: theme.colors.foreground, fontSize: 13, flex: 1 }}>{finding.title}</Text>
                  </View>
                  <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, paddingLeft: 4 }}>
                    {finding.detail}
                  </Text>
                  {finding.fix ? (
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, paddingLeft: 4, fontStyle: "italic" }}>
                      {finding.fix}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}
      {tab === "guide" ? <Guide theme={theme} onSelect={setTab} openDashboard={openDashboard} /> : null}
      {message ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={() => setMessage("")}>
          <View style={{ marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: 12 }}>{message}</Text>
          </View>
        </Pressable>
      ) : null}

      {/* ------------------------------------------------------------- SETUP */}
      {tab === "setup" ? (
        <>


          <Card theme={theme}>
            <Step theme={theme} index={1} title="Checklist" hint={remaining === 0 ? "all done" : `${remaining} left`} />
            {steps.map((step) => (
              <View key={step.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: step.done ? theme.colors.statusSuccess : theme.colors.foregroundMuted, fontSize: 13 }}>
                  {step.done ? "●" : "○"}
                </Text>
                <Text style={{ color: step.done ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 13 }}>
                  {step.label}
                </Text>
              </View>
            ))}
          </Card>

          {!data?.binary.path ? (
            <Card theme={theme}>
              <Step theme={theme} index={2} title="Install 9router" />
              <Note theme={theme}>Run this in a terminal, then come back and press Start.</Note>
              <View style={{ padding: 10, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
                <Text style={{ color: theme.colors.foreground, fontSize: 12, fontFamily: "Menlo" }}>
                  npm install -g 9router
                </Text>
              </View>
              <Button
                theme={theme}
                label="Copy command"
                onPress={() => {
                  Clipboard.setString("npm install -g 9router");
                  setMessage("Copied: npm install -g 9router");
                }}
              />
            </Card>
          ) : null}

          {data && data.warnings.length > 0 ? (
            <Card theme={theme}>
              <Step theme={theme} index={0} title="Needs attention" />
              {data.warnings.map((w) => (
                <Note key={w.id} theme={theme} tone="warning">
                  {w.severity === "danger" ? "⚠ " : ""}{w.title}. {w.detail}
                </Note>
              ))}
            </Card>
          ) : null}

          <Card theme={theme}>
            <Step theme={theme} index={data?.binary.path ? 2 : 3} title="Server" hint={data?.url} />
            <View style={{ gap: 5 }}>
              <Row theme={theme} label="Binary" value={data?.binary.path ?? "not installed"} tone={data?.binary.path ? "success" : "danger"} />
              <Row theme={theme} label="Status" value={data?.running ? "running" : "stopped"} tone={data?.running ? "success" : "warning"} />
              {data?.uptime.running ? (
                <>
                  <Row theme={theme} label="Uptime" value={formatDuration(data.uptime.uptimeSeconds)} tone="success" />
                  <Row theme={theme} label="Memory" value={data.uptime.rssMb !== null ? `${data.uptime.rssMb} MB` : "—"} />
                </>
              ) : (
                <Row theme={theme} label="Last seen" value={formatAgo(data?.uptime.lastSeenAt ?? null)} tone="warning" />
              )}
              {data && data.uptime.previousRunSeconds !== null ? (
                <Row theme={theme} label="Previous run" value={formatDuration(data.uptime.previousRunSeconds)} />
              ) : null}
              {data && data.uptime.restartsToday > 0 ? (
                <Row
                  theme={theme}
                  label="Restarts today"
                  value={String(data.uptime.restartsToday)}
                  tone={data.uptime.restartsToday >= 3 ? "danger" : "warning"}
                />
              ) : null}
              <Row theme={theme} label="API key" value={data?.apiKey.present ? `···${data.apiKey.last4 ?? ""}` : "none"} tone={data?.apiKey.present ? "success" : "warning"} />
              {data?.version?.hasUpdate ? <Row theme={theme} label="Update" value={`${data.version.latest} available`} tone="warning" /> : null}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {!data?.running ? (
                <Button theme={theme} label="Start 9router" tone="primary" disabled={!data?.binary.path} busy={startMutation.isPending} onPress={() => startMutation.mutate({ action: "start" })} />
              ) : (
                <>
                  <Button theme={theme} label="Restart" busy={startMutation.isPending && startMutation.variables?.action === "restart"} onPress={() => setConfirmAction({ title: "Restart 9Router?", detail: "This interrupts requests using this router. Wait for active routed sessions to finish first.", run: () => startMutation.mutate({ action: "restart" }) })} />
                  <Button theme={theme} label="Stop" busy={startMutation.isPending && startMutation.variables?.action === "stop"} onPress={() => setConfirmAction({ title: "Stop 9Router?", detail: "Models routed through this server will be unavailable until you start it again.", run: () => startMutation.mutate({ action: "stop" }) })} />
                </>
              )}
              <Button theme={theme} label="Copy dashboard link" busy={dashboardBusy} onPress={openDashboard} />
              <Button
                theme={theme}
                label="Copy loopback URL"
                onPress={() => copyDashboardLink(data?.dashboardUrl ?? "", "This is the router's own loopback address, so it only works from that machine.")}
              />
            </View>
            <Note theme={theme}>
              The dashboard signs you in with a cookie, which Paseo's built-in browser tab cannot hold — it shows
              a blank page there. Both buttons copy a link for your normal browser instead; "Copy dashboard link"
              picks the SSH forward, the running Cloudflare tunnel, or loopback, in that order.
            </Note>
            {forward.data?.open ? (
              <Note theme={theme} tone="warning">
                Forwarding {forward.data.target} to 127.0.0.1:{forward.data.localPort}
                {forwardCountdown ? ` — closes in ${forwardCountdown}` : ""}. "Copy dashboard link" now reaches that
                router, not this one.
              </Note>
            ) : null}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Remote dashboard" hint={forward.data?.open ? "forwarding" : undefined} />
            <Note theme={theme}>
              A dashboard is bound to its own machine's loopback, so opening the link from here reaches THIS
              machine's port — the wrong router, or nothing at all. Forward the remote port over SSH and the same
              link resolves where you are sitting. Nothing is published; the forward closes itself when the timer
              runs out.
            </Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Field theme={theme} value={forwardHost} onChangeText={setForwardHost} placeholder="user@host" />
              <Field theme={theme} value={forwardKey} onChangeText={setForwardKey} placeholder="~/.ssh/id_ed25519 (optional)" />
              <Field theme={theme} value={forwardMinutes} onChangeText={setForwardMinutes} placeholder="minutes (5)" />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {forward.data?.open ? (
                <>
                  <Button theme={theme} label={`Open (${forwardCountdown ?? "open"})`} tone="primary" onPress={openDashboard} />
                  <Button theme={theme} label="Close forward" tone="danger" onPress={closeForward} />
                </>
              ) : (
                <Button theme={theme} label="Forward and open" tone="primary" onPress={openForward} />
              )}
            </View>
            <Note theme={theme}>
              Always name a key when the host runs fail2ban: without one, ssh offers every key the agent holds and
              a host that refuses too many can ban this machine for its ban window.
            </Note>
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={data?.binary.path ? 3 : 4} title="Dashboard password" hint={data?.auth.ok ? "connected" : undefined} />
            <Note theme={theme}>
              This panel reads your accounts and quotas through 9router's own API, which wants the dashboard password.
              A fresh install uses {DEFAULT_PASSWORD} — it is prefilled below. Change it in the dashboard and save the
              new one here.
            </Note>
            {data?.auth.error ? <Note theme={theme} tone="warning">{data.auth.error}</Note> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Field theme={theme} value={url} onChangeText={setUrl} placeholder={data?.url ?? "http://127.0.0.1:20128"} />
              <Field theme={theme} value={password} onChangeText={setPassword} placeholder="dashboard password" secure />
              <Button
                theme={theme}
                label={data?.auth.ok ? "Save" : "Connect"}
                tone="primary"
                busy={saveMutation.isPending}
                disabled={!data?.running}
                onPress={() => saveMutation.mutate({ ...(url ? { url } : {}), ...(password ? { password } : {}) })}
              />
            </View>
            <Note theme={theme}>Stored at {data?.settingsPath} (mode 600). The key is never shown in full.</Note>
            {data?.auth.ok ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>Change it</Text>
                <Note theme={theme}>
                  Leaving 9router on its shipped password means anyone who can reach this port owns your accounts.
                </Note>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Field theme={theme} value={newPassword} onChangeText={setNewPassword} placeholder="new password" secure />
                  <Button
                    theme={theme}
                    label="Change password"
                    busy={passwordMutation.isPending}
                    disabled={!live || newPassword.length < 6}
                    onPress={() => {
                      passwordMutation.mutate({ currentPassword: password, newPassword });
                      setPassword(newPassword);
                      setNewPassword("");
                    }}
                  />
                </View>
              </View>
            ) : null}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={data?.binary.path ? 4 : 5} title="Machine-wide CLI routing" hint="optional" />
            <Note theme={theme}>
              Routing rewrites that CLI's own config, so every launch on this machine goes through 9router — not just
              Paseo's. Paseo's stock Claude and Codex chats pick it up with no further wiring. 9router routes more
              tools than these two; the rest are switched from its dashboard.
            </Note>
            {(data?.hijack ?? []).map((entry) => (
              <View key={entry.cli} style={{ gap: 4, opacity: entry.installed ? 1 : 0.55 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{entry.label}</Text>
                  {!entry.installed ? (
                    <Chip theme={theme} label="not installed" />
                  ) : (
                    <Chip theme={theme} label={entry.routed ? "through 9router" : "direct"} tone={entry.routed ? "success" : "neutral"} />
                  )}
                  {entry.installed && entry.supported ? (
                    <Button
                      theme={theme}
                      label={entry.routed ? "Restore direct" : "Route"}
                      tone={entry.routed ? "default" : "primary"}
                      disabled={!live}
                      busy={routeMutation.isPending && routeMutation.variables?.cli === entry.cli}
                      onPress={() => setConfirmAction({ title: `Change ${entry.label} routing?`, detail: "This rewrites this CLI’s configuration on the selected host and affects future launches outside Paseo too. Use the separate 9Router picker to keep direct CLI configuration.", run: () => routeMutation.mutate({ cli: entry.cli, routed: !entry.routed }) })}
                    />
                  ) : null}
                </View>
                {entry.routed && entry.configPath ? <Note theme={theme}>Writes {entry.configPath}</Note> : null}
                {entry.note ? <Note theme={theme}>{entry.note}</Note> : null}
              </View>
            ))}

            {tailscale.data ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    Tailscale detail
                  </Text>
                  <Chip
                    theme={theme}
                    label={!tailscale.data.installed ? "absent" : !tailscale.data.loggedIn ? "not signed in" : "ready"}
                    tone={!tailscale.data.installed ? "neutral" : !tailscale.data.loggedIn ? "warning" : "success"}
                  />
                </View>
                <Note theme={theme}>
                  Private and stable, unlike the Cloudflare quick tunnel above — that one is public and its URL
                  changes on every restart. {tailscale.data.detail}
                </Note>
                {tailscale.data.nextStep ? (
                  <Note theme={theme} tone="warning">{tailscale.data.nextStep}</Note>
                ) : null}
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {tailscale.data.canInstall ? (
                    <Button
                      theme={theme}
                      label="Install Tailscale"
                      tone="primary"
                      busy={tailscaleMutation.isPending}
                      onPress={() => tailscaleMutation.mutate({ action: "install" })}
                    />
                  ) : null}
                  {tailscale.data.installed && tailscale.data.loggedIn ? (
                    <Button
                      theme={theme}
                      label={tailscale.data.url ? "Unpublish" : "Publish privately"}
                      tone={tailscale.data.url ? "default" : "primary"}
                      busy={tailscaleMutation.isPending}
                      onPress={() =>
                        tailscaleMutation.mutate({ action: tailscale.data?.url ? "disable" : "enable" })
                      }
                    />
                  ) : null}
                  {tailscale.data.url ? (
                    <Button
                      theme={theme}
                      label="Copy address"
                      onPress={() => {
                        Clipboard.setString(tailscale.data?.url ?? "");
                        setMessage("Tailnet address copied.");
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            <Button theme={theme} label="Route the others in the dashboard" onPress={openDashboard} />
            {data?.clientVersion.advertised ? (
              <View style={{ gap: 4, padding: 10, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
                <Text style={{ color: theme.colors.statusWarning, fontSize: 13, fontWeight: "600" }}>
                  9router identifies as Claude Code {data.clientVersion.advertised}
                </Text>
                <Note theme={theme}>
                  {data.clientVersion.installed
                    ? `You have ${data.clientVersion.installed}. `
                    : ""}
                  9router sends its own hardcoded client version, so a model Anthropic gates behind a newer Claude
                  Code fails on every account — and 9router then parks them, which outlives the cause. Clear the
                  holds under Accounts once 9router ships a bump.
                </Note>
              </View>
            ) : null}
          </Card>


          <Card theme={theme}>
            <Step theme={theme} index={0} title="9router version" hint={version.data?.hasUpdate ? "update available" : "current"} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ color: theme.colors.foreground, fontSize: 13, flex: 1 }}>
                {version.data?.current ?? "—"}
              </Text>
              {version.data?.hasUpdate ? (
                <>
                  <Chip theme={theme} label={`→ ${version.data.latest ?? "?"}`} tone="warning" />
                  <Button
                    theme={theme}
                    label="Update and restart…"
                    tone="primary"
                    busy={updateMutation.isPending}
                    onPress={() => setConfirmAction({ title: "Update and restart 9Router?", detail: "The upstream updater replaces the installed router and restarts it. Active routed requests will be interrupted, and compiled-file customizations can be lost. Review Maintenance and wait for routed work to finish before continuing.", run: () => updateMutation.mutate({}) })}
                  />
                </>
              ) : (
                <Chip theme={theme} label="up to date" tone="success" />
              )}
            </View>
            <Note theme={theme}>{version.data?.detail ?? "Checking…"}</Note>
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Adaptive thinking" hint="does it survive the hop" />
            <Note theme={theme}>
              9router rewrites the thinking field on its way to Anthropic. When it gets that wrong the request 400s,
              9router counts it as a provider failure, and the NEXT valid request fails too — which reads as a
              rate-limit outage rather than a translation bug. One request tells you which it is.
            </Note>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Button
                theme={theme}
                label="Check"
                tone="primary"
                disabled={!live}
                busy={thinking.isFetching}
                onPress={() => void thinking.refetch()}
              />
              {thinking.data ? (
                <Chip
                  theme={theme}
                  label={thinking.data.state}
                  tone={
                    thinking.data.state === "ok"
                      ? "success"
                      : thinking.data.state === "broken"
                        ? "danger"
                        : "warning"
                  }
                />
              ) : null}
              {thinking.data?.model ? <Chip theme={theme} label={thinking.data.model} /> : null}
            </View>
            {thinking.data ? <Note theme={theme}>{thinking.data.detail}</Note> : null}
            {thinking.data?.fix ? (
              <Note theme={theme} tone="warning">{thinking.data.fix}</Note>
            ) : null}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={data?.binary.path ? 5 : 6} title="Remote access" hint="optional" />
            <Note theme={theme}>
              A tunnel publishes 9router past this machine, so the same accounts answer from anywhere. It is also a
              proxy holding live subscription credentials, so the key requirement below is not optional in practice —
              without it, anyone with the URL spends your quota.
            </Note>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>
                API key required on /v1
              </Text>
              <Chip
                theme={theme}
                label={tunnel.data?.requireApiKey ? "required" : "open"}
                tone={tunnel.data?.requireApiKey ? "success" : "danger"}
              />
              <Button
                theme={theme}
                label={tunnel.data?.requireApiKey ? "Make open" : "Require a key"}
                tone={tunnel.data?.requireApiKey ? "default" : "primary"}
                disabled={!live}
                busy={requireKeyMutation.isPending}
                onPress={() => requireKeyMutation.mutate({ required: !tunnel.data?.requireApiKey })}
              />
            </View>
            {(tunnel.data?.tunnels ?? []).map((entry) => (
              <View key={entry.provider} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    {entry.provider === "cloudflare" ? "Cloudflare tunnel" : "Tailscale"}
                  </Text>
                  <Chip
                    theme={theme}
                    label={entry.running ? "published" : entry.enabled ? "starting" : "off"}
                    tone={entry.running ? "warning" : "neutral"}
                  />
                  <Button
                    theme={theme}
                    label={entry.enabled ? "Stop" : "Publish"}
                    tone={entry.enabled ? "default" : "primary"}
                    disabled={!live}
                    busy={tunnelMutation.isPending && tunnelMutation.variables?.provider === entry.provider}
                    onPress={() => tunnelMutation.mutate({ provider: entry.provider, enabled: !entry.enabled })}
                  />
                </View>
                {entry.url ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                      {entry.url}
                    </Text>
                    <Button
                      theme={theme}
                      label="Copy"
                      onPress={() => {
                        Clipboard.setString(entry.url);
                        setMessage("Public URL copied. Treat it as a credential.");
                      }}
                    />
                  </View>
                ) : null}
                {entry.note ? <Note theme={theme}>{entry.note}</Note> : null}
              </View>
            ))}
          </Card>

          <Note theme={theme}>
            Routing a subscription sign-in through a local proxy is outside Anthropic's and OpenAI's consumer terms.
            That choice is yours to make.
          </Note>
        </>
      ) : null}

      {/* ---------------------------------------------------------- ACCOUNTS */}
      {tab === "accounts" ? (
        <>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {([ ["balances", "Accounts & quotas"], ["health", "Health & holds"], ["rotation", "Rotation & priority"] ] as const).map(([id, label]) => <Button key={id} theme={theme} label={label} tone={accountView === id ? "primary" : "default"} onPress={() => setAccountView(id)} />)}
          </View>
          {accountView === "rotation" ? <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="Selection strategy" hint="which account answers" />
            <Note theme={theme}>
              This decides which account absorbs a request, so it decides which one hits its ceiling first. With
              fallback the top account carries everything until it 429s; round-robin spreads the load so no single
              account is exhausted while the others sit idle.
            </Note>
            {strategies.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {(strategies.data?.strategies ?? []).map((entry) => (
              <View key={entry.provider} style={{ gap: 6, paddingVertical: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    {entry.label}
                  </Text>
                  <Chip theme={theme} label={`${entry.accounts} account${entry.accounts === 1 ? "" : "s"}`} />
                </View>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {(["fallback", "round-robin", "priority", "random"] as const).map((option) => {
                    const selected = (entry.strategy ?? "fallback") === option;
                    return (
                      <Pressable
                        key={option}
                        disabled={strategyMutation.isPending}
                        onPress={() =>
                          strategyMutation.mutate({
                            provider: entry.provider,
                            strategy: option,
                            stickyLimit: option === "round-robin" ? (entry.stickyLimit ?? strategies.data?.defaultStickyLimit ?? 3) : null,
                          })
                        }
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                          backgroundColor: selected ? theme.colors.accent : theme.colors.surface1,
                          borderColor: theme.colors.border,
                          borderWidth: selected ? 0 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? theme.colors.accentForeground : theme.colors.foregroundMuted,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{entry.detail}</Text>
              </View>
            ))}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Order accounts" hint={`${order.data?.connections.length ?? 0}`} />
            <Note theme={theme}>
              9router tries accounts in priority order, lowest first, so this decides which one answers. Park an
              account to rest it without deleting it — its tokens are kept.
            </Note>
            {(order.data?.connections ?? []).map((connection) => (
              <View
                key={connection.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface2,
                  opacity: connection.isActive ? 1 : 0.55,
                }}
              >
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, width: 22 }}>
                  {connection.priority}
                </Text>
                <Text style={{ color: theme.colors.foreground, fontSize: 12, flex: 1 }} numberOfLines={1}>
                  {providerLabel(connection.provider)} · {connection.label}
                </Text>
                <Button
                  theme={theme}
                  label="↑"
                  disabled={connection.priority <= 1 || priorityMutation.isPending}
                  onPress={() =>
                    priorityMutation.mutate({ id: connection.id, priority: connection.priority - 1 })
                  }
                />
                <Button
                  theme={theme}
                  label="↓"
                  disabled={connection.priority >= 99 || priorityMutation.isPending}
                  onPress={() =>
                    priorityMutation.mutate({ id: connection.id, priority: connection.priority + 1 })
                  }
                />
                <Button
                  theme={theme}
                  label={connection.isActive ? "Park" : "Use"}
                  busy={activeMutation.isPending}
                  onPress={() => activeMutation.mutate({ id: connection.id, isActive: !connection.isActive })}
                />
              </View>
            ))}
          </Card>
          </> : null}
          {accountView === "health" ? <>
          {stuck.length > 0 ? (
            <Card theme={theme}>
              <Step theme={theme} index={0} title="Stuck accounts" hint={`${stuck.length}`} />
              <Note theme={theme} tone="warning">
                {stuck.length === 1 ? "This account is" : "These accounts are"} active but backed off past the point 9router
                retries {stuck.length === 1 ? "it" : "them"}, so the pool is serving from fewer accounts than it shows. Reset
                backoff under Account health below to put {stuck.length === 1 ? "it" : "them"} back to work. Accounts are
                shared by every workspace on this host, so the reset applies to all of them.
              </Note>
              {stuck.map((connection) => (
                <Row
                  theme={theme}
                  key={connection.id}
                  label={`${connection.email || connection.name || connection.id.slice(0, 8)} (${providerLabel(connection.provider)})`}
                  value={`backoff ${connection.backoffLevel}${connection.lastError ? ` · ${connection.lastError}` : ""}`}
                  tone="danger"
                />
              ))}
            </Card>
          ) : null}
          <Card theme={theme}>
            <Step theme={theme} index={0} title="Account health" hint={`${health.data?.connections.length ?? 0}`} />
            <Note theme={theme}>
              What decides whether a model answers lives on the account, not the model. An expired token, an
              active backoff, or a model lock pinning the account to one model are all invisible in the picker.
            </Note>
            {(health.data?.connections ?? []).map((connection) => {
              const expiring = connection.expiresInMinutes !== null && connection.expiresInMinutes < 60;
              const isStuck = stuck.includes(connection);
              return (
                <View
                  key={connection.id}
                  style={{ gap: 4, padding: 8, borderRadius: 8, backgroundColor: theme.colors.surface2 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600", flex: 1 }}>
                      {providerLabel(connection.provider)} · {connection.email || connection.name || connection.id.slice(0, 8)}
                    </Text>
                    <Chip
                      theme={theme}
                      label={!connection.isActive ? "inactive" : isStuck ? `stuck · backoff ${connection.backoffLevel}` : "active"}
                      tone={!connection.isActive ? "neutral" : isStuck ? "danger" : "success"}
                    />
                  </View>
                  {connection.modelLocks.length > 0 ? (
                    <Text style={{ color: theme.colors.statusWarning, fontSize: 11 }}>
                      Locked to {connection.modelLocks.join(", ")} — requests to this account answer with that
                      model whatever was asked for.
                    </Text>
                  ) : null}
                  {connection.backoffLevel > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.colors.statusWarning, fontSize: 11, flex: 1, minWidth: 160 }}>
                        Backoff level {connection.backoffLevel} — 9router is resting this account.
                      </Text>
                      <Button
                        theme={theme}
                        label="Reset backoff"
                        busy={clearHoldMutation.isPending}
                        onPress={() =>
                          clearHoldMutation.mutate({ provider: connection.provider, model: "", connectionId: connection.id })
                        }
                      />
                    </View>
                  ) : null}
                  {connection.expiresInMinutes !== null ? (
                    <Text
                      style={{
                        color: expiring ? theme.colors.statusWarning : theme.colors.foregroundMuted,
                        fontSize: 11,
                      }}
                    >
                      {connection.expiresInMinutes < 0
                        ? `Token expired ${Math.abs(connection.expiresInMinutes)}m ago`
                        : `Token valid for ${connection.expiresInMinutes}m`}
                    </Text>
                  ) : null}
                  {connection.lastError ? (
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }} numberOfLines={2}>
                      {connection.lastError}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </Card>
          {holdCount > 0 ? (
            <Card theme={theme}>
              <Step theme={theme} index={0} title="Parked accounts" hint={`${holdCount}`} />
              <Note theme={theme}>
                9router stops using an account after an error and keeps the hold until it expires. If you have fixed
                the cause, clear it here rather than waiting.
              </Note>
              {(holds.data?.holds ?? []).map((hold, index) => (
                <View key={`${hold.provider}-${hold.connectionName}-${index}`} style={{ gap: 4, padding: 8, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600", flex: 1 }}>
                      {providerLabel(hold.provider)} · {hold.connectionName}
                    </Text>
                    <Button
                      theme={theme}
                      label="Clear"
                      busy={clearHoldMutation.isPending}
                      onPress={() => clearHoldMutation.mutate({ provider: hold.provider, model: hold.model, connectionId: hold.connectionId })}
                    />
                  </View>
                  {hold.lastError ? (
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }} numberOfLines={3}>
                      {hold.lastError}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}

          </> : null}
          {accountView === "balances" ? <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="Connected" hint={`${data?.connections.length ?? 0}`} />
            {!live ? <Note theme={theme} tone="warning">Finish Setup first — accounts need the dashboard password.</Note> : null}
            {live && (data?.connections.length ?? 0) === 0 ? (
              <Note theme={theme}>No accounts yet. Connect one below, or add any other provider from the dashboard.</Note>
            ) : null}
            <Field theme={theme} value={accountQuery} onChangeText={setAccountQuery} placeholder="Search accounts or providers" />
            {byProvider.size === 0 && accountQuery ? <Note theme={theme}>No accounts match this search.</Note> : null}
            {[...byProvider.entries()].map(([provider, list]) => (
              <View key={provider} style={{ gap: 8 }}>
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "700" }}>
                  {providerLabel(provider)} · {list.length}
                </Text>
                {list.map((connection) => (
                  <View
                    key={connection.id}
                    style={{ borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, gap: 6, backgroundColor: theme.colors.surface0 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{connection.name}</Text>
                      <Chip theme={theme} label={`#${connection.priority}`} />
                      {connection.usage?.plan ? <Chip theme={theme} label={connection.usage.plan} /> : null}
                      {connection.usage?.limitReached ? <Chip theme={theme} label="limit reached" tone="danger" /> : null}
                      {connection.usage?.extra?.spendLimitReached ? (
                        <Chip theme={theme} label="spend cap" tone="danger" />
                      ) : null}
                    </View>
                    {(connection.usage?.quotas ?? []).map((quota) => (
                      <QuotaBar key={quota.label} theme={theme} quota={quota} />
                    ))}
                    {connection.usage?.extra ? <SpendRow theme={theme} extra={connection.usage.extra} /> : null}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {confirmRemove === connection.id ? (
                        <>
                          <Button
                            theme={theme}
                            label="Really remove"
                            tone="danger"
                            busy={removeMutation.isPending}
                            onPress={() => {
                              removeMutation.mutate({ id: connection.id });
                              setConfirmRemove(null);
                            }}
                          />
                          <Button theme={theme} label="Cancel" onPress={() => setConfirmRemove(null)} />
                        </>
                      ) : (
                        <Button theme={theme} label="Remove" onPress={() => setConfirmRemove(connection.id)} />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button theme={theme} label="Connect Claude" disabled={!live} busy={connectMutation.isPending && connectMutation.variables === "claude"} onPress={() => connectMutation.mutate("claude")} />
              <Button theme={theme} label="Connect Codex" disabled={!live} busy={connectMutation.isPending && connectMutation.variables === "codex"} onPress={() => connectMutation.mutate("codex")} />
              <Button theme={theme} label="More in dashboard" onPress={openDashboard} />
            </View>
            {signIn ? (
              <View style={{ gap: 8, padding: 10, borderRadius: 8, backgroundColor: theme.colors.surface2 }}>
                <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }}>
                  Signing in to {signIn.provider === "claude" ? "Claude" : "Codex"}
                </Text>
                <Note theme={theme}>
                  The link is on your clipboard. Open it in a NORMAL browser — Paseo&apos;s own browser tab cannot
                  complete an OAuth sign-in.{" "}
                  {signIn.mode === "poll"
                    ? "Finish there, then press Check."
                    : "Approve there, copy the code it shows, and paste it below."}
                </Note>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Button theme={theme} label="Copy link again" onPress={() => { Clipboard.setString(signIn.authUrl); setMessage("Sign-in link copied."); }} />
                  {signIn.mode === "paste-code" ? (
                    <Field theme={theme} value={pasted} onChangeText={setPasted} placeholder="paste code or callback URL" />
                  ) : null}
                  <Button theme={theme} label={signIn.mode === "poll" ? "Check" : "Finish"} tone="primary" busy={finishMutation.isPending} onPress={() => finishMutation.mutate()} />
                  <Button theme={theme} label="Cancel" onPress={() => setSignIn(null)} />
                </View>
              </View>
            ) : null}
          </Card>
          </> : null}
        </>
      ) : null}

      {tab === "models" ? <>
        <ModelCatalog theme={theme} compact={layout.compact} ids={data?.models.ids ?? []} availability={availability.data?.models ?? []} selected={syncSelection.data?.selected ?? []} live={live} selectionReady={syncSelection.isSuccess && !selectionMutation.isPending} testPending={testMutation.isPending} testing={testMutation.variables?.model} onTest={(model) => testMutation.mutate({ model })} onToggle={(id) => { const current = syncSelection.data?.selected ?? []; selectionMutation.mutate({ selected: current.includes(id) ? current.filter((model) => model !== id) : [...current, id] }); }} />
        {testResult ? <Card theme={theme}><Chip theme={theme} label={testResult.ok ? "Request succeeded" : "Request failed"} tone={testResult.ok ? "success" : "danger"} /><Note theme={theme}>{testResult.model}: {testResult.message}</Note></Card> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button theme={theme} label="Sync picker selection" onPress={() => setTab("picker")} /><Button theme={theme} label="Add Astra or a custom model" onPress={() => setTab("custom")} /></View>
      </> : null}
      {tab === "picker" ? <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="In Paseo's picker" hint={data?.paseo.modelsInSync ? "in sync" : undefined} />
            <Note theme={theme}>
              Sync writes a single 9Router provider carrying every model 9router serves — Claude, Codex, and every
              other connected pool — because 9router translates them all into one wire format. Your direct Claude and Codex CLI settings stay separate. Select the 9Router provider when creating a routed session.
            </Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Chip theme={theme} label={`${data?.paseo.listedModels.claude.length ?? 0} Claude`} tone={data?.paseo.listedModels.claude.length ? "success" : "neutral"} />
              <Chip theme={theme} label={`${data?.paseo.listedModels.codex.length ?? 0} Codex`} tone={data?.paseo.listedModels.codex.length ? "success" : "neutral"} />
              <Button theme={theme} label="Refresh catalogue" disabled={!data?.running} busy={catalogSyncMutation.isPending} onPress={() => catalogSyncMutation.mutate({})} />
              <Button theme={theme} label="Sync into Paseo" tone="primary" disabled={!data?.running} busy={syncMutation.isPending} onPress={() => syncMutation.mutate({})} />
            </View>
            {(data?.paseo.staleProviders.length ?? 0) > 0 ? (
              <Note theme={theme} tone="warning">Old provider entries still present: {data?.paseo.staleProviders.join(", ")} — Sync removes them.</Note>
            ) : null}
            <Note theme={theme}>
              Sync publishes a snapshot. If 9router has learned a model since the last one, press Refresh
              catalogue first — otherwise the new model stays invisible to Paseo however often you sync.
            </Note>
            <Note theme={theme}>
              {(syncSelection.data?.selected.length ?? 0) === 0
                ? `Syncing all ${data?.models.count ?? 0} models. Tap below to choose a shorter list instead.`
                : `Syncing ${syncSelection.data?.selected.length} chosen model(s).`}
            </Note>
            <Button theme={theme} label="Choose models in the catalog" onPress={() => setTab("models")} />
            {(syncSelection.data?.selected.length ?? 0) > 0 ? (
              <Button theme={theme} label="Sync everything instead" onPress={() => selectionMutation.mutate({ selected: [] })} />
            ) : null}
          </Card>

      </> : null}
      {tab === "custom" ? <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="Expose a model" />
            <Note theme={theme}>
              Add GPT-6 Astra to 9Router's catalogue, aliases and model picker in one step.
            </Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button theme={theme} label="Add GPT-6 Astra" disabled={!live}
                busy={addAstraMutation.isPending} onPress={() => addAstraMutation.mutate({})} />
              {data?.models.ids.includes("cx/gpt-6-astra") ? (
                <Button theme={theme} label="Test Astra (uses quota)"
                  busy={testMutation.isPending && testMutation.variables?.model === "cx/gpt-6-astra"}
                  onPress={() => testMutation.mutate({ model: "cx/gpt-6-astra" })} />
              ) : null}
            </View>
            <Note theme={theme}>
              9router ships a fixed catalogue, so a model it does not know yet is invisible until you add it — this is
              how cc/claude-fable-5-1 got here.
            </Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Field theme={theme} value={exposeAlias} onChangeText={setExposeAlias} placeholder="cc" />
              <Field theme={theme} value={exposeId} onChangeText={setExposeId} placeholder="claude-fable-5-1" />
              <Field theme={theme} value={exposeName} onChangeText={setExposeName} placeholder="Claude Fable 5.1" />
              <Button
                theme={theme}
                label="Expose"
                busy={exposeMutation.isPending}
                disabled={!live || !exposeAlias || !exposeId}
                onPress={() => {
                  exposeMutation.mutate({ providerAlias: exposeAlias, id: exposeId, ...(exposeName ? { name: exposeName } : {}) });
                  setExposeId("");
                  setExposeName("");
                }}
              />
            </View>
            {(data?.models.custom.length ?? 0) > 0 ? (
              <Note theme={theme}>Custom: {data?.models.custom.map((model) => `${model.providerAlias}/${model.id}`).join(", ")}</Note>
            ) : null}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Aliases" />
            <Note theme={theme}>
              Map a plain model name onto a 9router model. With one of these, Paseo's stock picker entries route
              through 9router without listing anything.
            </Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Field theme={theme} value={aliasFrom} onChangeText={setAliasFrom} placeholder="claude-opus-5" />
              <Field theme={theme} value={aliasTo} onChangeText={setAliasTo} placeholder="cc/claude-opus-5" />
              <Button
                theme={theme}
                label="Add"
                busy={aliasSetMutation.isPending}
                disabled={!live || !aliasFrom || !aliasTo}
                onPress={() => {
                  aliasSetMutation.mutate({ alias: aliasFrom, model: aliasTo });
                  setAliasFrom("");
                  setAliasTo("");
                }}
              />
            </View>
            {(data?.aliases ?? []).map((alias) => (
              <View key={alias.alias} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                  {alias.alias} → {alias.model}
                </Text>
                <Button theme={theme} label="Remove" onPress={() => aliasRemoveMutation.mutate({ alias: alias.alias })} />
              </View>
            ))}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Combos" hint={`${data?.combos.length ?? 0}`} />
            <Note theme={theme}>
              A combo is an ordered fallback list that behaves like one model. Build one from the models listed in
              Paseo and it survives an exhausted account without you choosing again.
            </Note>
            {(data?.combos ?? []).map((combo) => (
              <Text key={combo.name} style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                {combo.name}: {combo.models.join(" → ")}
              </Text>
            ))}
            <Note theme={theme}>Build and reorder fallback chains in Routing & Access → API keys & combos.</Note>
            <Button theme={theme} label="Manage fallback combos" onPress={() => setTab("keys")} />
          </Card>
      </> : null}

      {/* -------------------------------------------------------------- KEYS */}
      {tab === "keys" ? (
        <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="API keys" hint={`${keys.data?.keys.length ?? 0}`} />
            <Note theme={theme}>
              Anything pointed at {data?.url}/v1 authenticates with one of these. Give each tool its own, so revoking
              one does not sign the others out.
            </Note>
            {!live ? <Note theme={theme} tone="warning">Finish Setup first.</Note> : null}
            {(keys.data?.keys ?? []).map((entry) => (
              <View
                key={entry.id}
                style={{ borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, gap: 6, backgroundColor: theme.colors.surface0 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{entry.name}</Text>
                  <Chip theme={theme} label={`···${entry.last4}`} />
                  {!entry.isActive ? <Chip theme={theme} label="inactive" tone="warning" /> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Button theme={theme} label="Copy key" busy={keyRevealMutation.isPending} onPress={() => keyRevealMutation.mutate({ id: entry.id })} />
                  {confirmDelete === entry.id ? (
                    <>
                      <Button
                        theme={theme}
                        label="Really delete"
                        tone="danger"
                        busy={keyDeleteMutation.isPending}
                        onPress={() => {
                          keyDeleteMutation.mutate({ id: entry.id });
                          setConfirmDelete(null);
                        }}
                      />
                      <Button theme={theme} label="Cancel" onPress={() => setConfirmDelete(null)} />
                    </>
                  ) : (
                    <Button theme={theme} label="Delete" onPress={() => setConfirmDelete(entry.id)} />
                  )}
                </View>
              </View>
            ))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Field theme={theme} value={keyName} onChangeText={setKeyName} placeholder="name, e.g. Zed" />
              <Button
                theme={theme}
                label="Create key"
                busy={keyCreateMutation.isPending}
                disabled={!live || !keyName}
                onPress={() => {
                  keyCreateMutation.mutate({ name: keyName });
                  setKeyName("");
                }}
              />
            </View>
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Combos" hint={`${combos.data?.combos.length ?? 0}`} />
            <Note theme={theme}>
              A combo is an ordered fallback list that behaves like a single model: when the first is exhausted or
              erroring, 9router moves down the list without you choosing again.
            </Note>
            {(combos.data?.combos ?? []).map((combo) => (
              <View
                key={combo.id}
                style={{ borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, gap: 6, backgroundColor: theme.colors.surface0 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{combo.name}</Text>
                  {combo.kind ? <Chip theme={theme} label={combo.kind} /> : null}
                  <Button theme={theme} label="Delete" busy={comboDeleteMutation.isPending} onPress={() => comboDeleteMutation.mutate({ id: combo.id })} />
                </View>
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{combo.models.join("  →  ")}</Text>
              </View>
            ))}
            <Note theme={theme}>Build one by tapping models in order, first choice first.</Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(data?.models.ids ?? [])
                .filter((id) => cliForModel(id) !== "other")
                .slice(0, 24)
                .map((id) => {
                  const position = comboModels.indexOf(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() =>
                        setComboModels((current) =>
                          current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
                        )
                      }
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: position >= 0 ? theme.colors.accent : theme.colors.border,
                        backgroundColor: position >= 0 ? theme.colors.accent : "transparent",
                      }}
                    >
                      <Text style={{ color: position >= 0 ? theme.colors.accentForeground : theme.colors.foregroundMuted, fontSize: 11 }}>
                        {position >= 0 ? `${position + 1}. ` : ""}
                        {id}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Field theme={theme} value={comboName} onChangeText={setComboName} placeholder="combo name" />
              <Button
                theme={theme}
                label={`Save combo (${comboModels.length})`}
                tone="primary"
                busy={comboSaveMutation.isPending}
                disabled={!live || !comboName || comboModels.length === 0}
                onPress={() => {
                  comboSaveMutation.mutate({ name: comboName, models: comboModels });
                  setComboName("");
                  setComboModels([]);
                }}
              />
              {comboModels.length > 0 ? <Button theme={theme} label="Clear" onPress={() => setComboModels([])} /> : null}
            </View>
          </Card>
        </>
      ) : null}

      {/* ------------------------------------------------------------ TUNING */}
      {tab === "tuning" ? (
        <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="Token savers" />
            <Note theme={theme}>
              These rewrite what reaches the model, so they trade fidelity for tokens. 9router applies them to every
              request it routes — including this chat, once a CLI is routed.
            </Note>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button theme={theme} label="RTK" onPress={() => openLink("https://github.com/rtk-ai/rtk")} />
              <Button theme={theme} label="Caveman" onPress={() => openLink("https://github.com/JuliusBrussee/caveman")} />
              <Button theme={theme} label="Ponytail" onPress={() => openLink("https://github.com/DietrichGebert/ponytail")} />
              <Button theme={theme} label="Token savers in the dashboard" onPress={() => copyDashboardLink(`${data?.url ?? ""}/dashboard/token-saver`, "")} />
            </View>
            {!live ? <Note theme={theme} tone="warning">Finish Setup first.</Note> : null}
            {tuning.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {tuning.data ? (
              <View style={{ gap: 12 }}>
                <Toggle
                  theme={theme}
                  label="RTK"
                  hint="Compresses tool output (git diff, grep, build logs) before it is sent. Usually the cheapest win. — github.com/rtk-ai/rtk"
                  on={tuning.data.rtkEnabled}
                  busy={tuningMutation.isPending}
                  disabled={!live}
                  onToggle={() => tuningMutation.mutate({ rtkEnabled: !tuning.data.rtkEnabled })}
                />
                <Toggle
                  theme={theme}
                  label={`Caveman (${tuning.data.cavemanLevel})`}
                  hint="Rewrites the system prompt in terse english. Saves a lot, and changes how the model writes. — github.com/JuliusBrussee/caveman"
                  on={tuning.data.cavemanEnabled}
                  busy={tuningMutation.isPending}
                  disabled={!live}
                  onToggle={() => tuningMutation.mutate({ cavemanEnabled: !tuning.data.cavemanEnabled })}
                />
                {tuning.data.cavemanEnabled ? (
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {["lite", "full"].map((level) => (
                      <Button
                        key={level}
                        theme={theme}
                        label={level}
                        tone={tuning.data.cavemanLevel === level ? "primary" : "default"}
                        disabled={!live}
                        onPress={() => tuningMutation.mutate({ cavemanLevel: level })}
                      />
                    ))}
                  </View>
                ) : null}
                <Toggle
                  theme={theme}
                  label={`Ponytail (${tuning.data.ponytailLevel})`}
                  hint="Injects a YAGNI-first coding style so replies stay short. — github.com/DietrichGebert/ponytail"
                  on={tuning.data.ponytailEnabled}
                  busy={tuningMutation.isPending}
                  disabled={!live}
                  onToggle={() => tuningMutation.mutate({ ponytailEnabled: !tuning.data.ponytailEnabled })}
                />
                <Toggle
                  theme={theme}
                  label="Headroom"
                  hint={`Context compression through a separate service at ${tuning.data.headroomUrl}. Needs that service running.`}
                  on={tuning.data.headroomEnabled}
                  busy={tuningMutation.isPending}
                  disabled={!live}
                  onToggle={() => tuningMutation.mutate({ headroomEnabled: !tuning.data.headroomEnabled })}
                />
              </View>
            ) : null}
          </Card>

          {tuning.data ? (
            <Card theme={theme}>
              <Step theme={theme} index={0} title="Routing" />
              <Note theme={theme}>
                How 9router picks among the accounts in a pool, and how a combo falls through its list.
              </Note>
              <View style={{ gap: 5 }}>
                <Row theme={theme} label="Combo strategy" value={tuning.data.comboStrategy} />
                <Row theme={theme} label="Sticky round-robin limit" value={String(tuning.data.stickyRoundRobinLimit)} />
                <Row theme={theme} label="API key required on /v1" value={tuning.data.requireApiKey ? "yes" : "no"} tone={tuning.data.requireApiKey ? "success" : "warning"} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {["fallback", "roundrobin"].map((strategy) => (
                  <Button
                    key={strategy}
                    theme={theme}
                    label={strategy}
                    tone={tuning.data.comboStrategy === strategy ? "primary" : "default"}
                    disabled={!live}
                    onPress={() => tuningMutation.mutate({ comboStrategy: strategy })}
                  />
                ))}
              </View>
              <Note theme={theme}>Per-provider strategies and capacity adapters live in the dashboard.</Note>
              <Button theme={theme} label="Copy dashboard link" onPress={openDashboard} />
            </Card>
          ) : null}
        </>
      ) : null}

      {/* -------------------------------------------------------------- LOGS */}
      {tab === "logs" ? (
        <>
          <Card theme={theme}>
            <Step
              theme={theme}
              index={0}
              title="Failed requests"
              hint={requestLogs.data ? `${requestLogs.data.requests.length}` : undefined}
            />
            <Note theme={theme}>
              The console below is 9router talking to itself; this is the request as the caller saw it. A model
              that "does not work" usually has one row here with the status and the upstream reason.
            </Note>
            {requestLogs.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {(requestLogs.data?.requests.length ?? 0) === 0 && !requestLogs.isLoading ? (
              <Note theme={theme}>No failed requests recorded.</Note>
            ) : null}
            {(requestLogs.data?.requests ?? []).map((request, index) => (
              <View
                key={`${request.id}-${index}`}
                style={{ gap: 2, padding: 8, borderRadius: 8, backgroundColor: theme.colors.surface2 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "600", flex: 1 }}>
                    {request.model || "unknown model"}
                  </Text>
                  {request.status !== null ? (
                    <Chip theme={theme} label={`${request.status}`} tone="danger" />
                  ) : null}
                </View>
                {request.error ? (
                  <Text style={{ color: theme.colors.statusWarning, fontSize: 11 }} numberOfLines={3}>
                    {request.error}
                  </Text>
                ) : null}
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 10 }}>
                  {[request.at, request.provider, request.latencyMs !== null ? `${request.latencyMs}ms` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ))}
          </Card>
          <Card theme={theme}>
          <Step theme={theme} index={0} title="9router console" hint={logs.data ? `${logs.data.lines.length} lines` : undefined} />
          <Note theme={theme}>
            Live from 9router, newest last, refreshed every 4s. This is where a routing failure explains itself — the
            account it chose, the upstream error, what RTK saved.
          </Note>
          {!live ? <Note theme={theme} tone="warning">Finish Setup first.</Note> : null}
          {logs.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
          <View style={{ backgroundColor: theme.colors.surface0, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 8, gap: 2 }}>
            {(logs.data?.lines ?? []).slice(-120).map((line, index) => (
              <Text
                key={`${index}-${line.slice(0, 24)}`}
                style={{
                  color: /error|failed|✗|⚠/i.test(line)
                    ? theme.colors.statusDanger
                    : /DONE|✓/i.test(line)
                      ? theme.colors.statusSuccess
                      : theme.colors.foregroundMuted,
                  fontSize: 10,
                  fontFamily: "Menlo",
                }}
              >
                {line}
              </Text>
            ))}
            {(logs.data?.lines.length ?? 0) === 0 && !logs.isLoading ? (
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>Nothing logged yet.</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button theme={theme} label="Refresh" busy={logs.isFetching} onPress={() => void logs.refetch()} />
            <Button
              theme={theme}
              label="Copy"
              onPress={() => {
                Clipboard.setString((logs.data?.lines ?? []).join("\n"));
                setMessage("Console copied.");
              }}
            />
          </View>
          </Card>
        </>
      ) : null}


      {/* ---------------------------------------------------------- POWER-UPS */}
      {tab === "powerups" ? (
        <Card theme={theme}>
          <Step theme={theme} index={0} title="Optional maintenance actions" />
          <Note theme={theme}>
            These change software this plugin does not own. Each one is reversible here and re-checked from disk every
            time this tab opens, because a package upgrade silently undoes them.
          </Note>
          {powerUps.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
          {(powerUps.data?.powerUps ?? []).map((entry) => (
            <View
              key={entry.id}
              style={{ borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, padding: 10, gap: 6, backgroundColor: theme.colors.surface0 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{entry.title}</Text>
                {entry.action === "toggle" ? (
                  <Chip theme={theme} label={entry.applied ? "applied" : "not applied"} tone={entry.applied ? "success" : "neutral"} />
                ) : null}
                <Button
                  theme={theme}
                  label={entry.action === "run" ? "Run" : entry.applied ? "Revert" : "Apply"}
                  tone={entry.action === "run" || !entry.applied ? "primary" : "default"}
                  disabled={!entry.available}
                  busy={powerUpMutation.isPending && powerUpMutation.variables?.id === entry.id}
                  onPress={() => powerUpMutation.mutate({ id: entry.id, apply: !entry.applied })}
                />
              </View>
              <Note theme={theme}>{entry.detail}</Note>
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{entry.status}</Text>
              <Note theme={theme} tone="warning">{entry.caution}</Note>
            </View>
          ))}
          <Note theme={theme}>
            Background on the version gate: platform.claude.com/docs/en/models/fable-5-1/migration-guide and
            github.com/decolua/9router/issues/3711
          </Note>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button theme={theme} label="Migration guide" onPress={() => openLink("https://platform.claude.com/docs/en/models/fable-5-1/migration-guide")} />
            <Button theme={theme} label="9router issue 3711" onPress={() => openLink("https://github.com/decolua/9router/issues/3711")} />
          </View>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------- USAGE */}
      {tab === "usage" ? (
        <>
          <Card theme={theme}>
            <Step
              theme={theme}
              index={0}
              title="Daily usage"
              hint={`last ${chartDays} days`}
            />
            <Note theme={theme}>
              A total says how much you have spent; a series says whether today is unusual. That is the difference
              between noticing a burn while it builds and finding it after a rate limit.
            </Note>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {[7, 14, 30].map((days) => (
                <Pressable
                  key={days}
                  onPress={() => setChartDays(days)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: chartDays === days ? theme.colors.accent : theme.colors.surface1,
                    borderColor: theme.colors.border,
                    borderWidth: chartDays === days ? 0 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: chartDays === days ? theme.colors.accentForeground : theme.colors.foregroundMuted,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {days}d
                  </Text>
                </Pressable>
              ))}
            </View>
            {usageChart.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {usageChart.data?.message ? (
              <Note theme={theme} tone="warning">{usageChart.data.message}</Note>
            ) : null}
            {usageChart.data?.trend ? <Note theme={theme}>{usageChart.data.trend}</Note> : null}
            {(usageChart.data?.points ?? []).map((point) => {
              const peak = usageChart.data?.peakTokens ?? 0;
              // Zero-token days still get a hairline, so a gap reads as "no
              // traffic" rather than as a missing row.
              const fraction = peak > 0 ? point.tokens / peak : 0;
              return (
                <View key={point.label} style={{ gap: 2, paddingVertical: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{point.label}</Text>
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
                      {point.tokens > 0 ? `${(point.tokens / 1e6).toFixed(0)}M · $${point.cost.toFixed(0)}` : "—"}
                    </Text>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: "hidden" }}>
                    <View
                      style={{
                        width: `${Math.max(fraction > 0 ? 2 : 0, fraction * 100)}%`,
                        height: 4,
                        backgroundColor: fraction > 0.75 ? theme.colors.statusWarning : theme.colors.accent,
                      }}
                    />
                  </View>
                </View>
              );
            })}
            {usageChart.data && usageChart.data.points.length > 0 ? (
              <Row
                theme={theme}
                label={`${chartDays}-day total`}
                value={`${(usageChart.data.totalTokens / 1e9).toFixed(2)}B tokens · $${usageChart.data.totalCost.toFixed(0)}`}
              />
            ) : null}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Last day" hint={lastDayTotals ? lastDayTotals.label : `last ${HOST_SPEND_DAYS}d`} />
            {lastDay.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {lastDay.data && !lastDay.data.ok ? <Note theme={theme} tone="warning">{lastDay.data.message ?? "9router did not return usage."}</Note> : null}
            {lastDayTotals ? (
              <View style={{ gap: 5 }}>
                <Row theme={theme} label="Requests" value={compactNumber(lastDayTotals.requests)} />
                <Row theme={theme} label="Tokens in / out" value={`${compactNumber(lastDayTotals.promptTokens)} / ${compactNumber(lastDayTotals.completionTokens)}`} />
                <Row theme={theme} label="API-equivalent cost" value={`$${lastDayTotals.cost.toFixed(2)}`} />
              </View>
            ) : null}
            <Note theme={theme}>
              These figures cover every workspace on this host. 9router records provider, model, account and API key per
              request, and every Paseo session shares one key, so no request can be tied back to a workspace.
            </Note>
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Totals" hint="since install" />
            {!live ? <Note theme={theme} tone="warning">Finish Setup first — usage needs the dashboard password.</Note> : null}
            {usage.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {usage.data ? (
              <View style={{ gap: 5 }}>
                <Row theme={theme} label="Requests" value={usage.data.totalRequests.toLocaleString()} />
                <Row theme={theme} label="Cost (what these would have cost on API pricing)" value={`$${usage.data.totalCost.toFixed(2)}`} />
                <Row theme={theme} label="Prompt tokens" value={usage.data.totalPromptTokens.toLocaleString()} />
                <Row theme={theme} label="Cached tokens" value={usage.data.totalCachedTokens.toLocaleString()} />
                <Row theme={theme} label="Completion tokens" value={usage.data.totalCompletionTokens.toLocaleString()} />
              </View>
            ) : null}
          </Card>

          {usage.data && usage.data.byProvider.length > 0 ? (
            <Card theme={theme}>
              <Step theme={theme} index={0} title="By provider" />
              {usage.data.byProvider.map((entry) => (
                <Row key={entry.provider} label={providerLabel(entry.provider)} theme={theme} value={`${entry.requests} req · $${entry.cost.toFixed(2)}`} />
              ))}
            </Card>
          ) : null}

          {usage.data && usage.data.byModel.length > 0 ? (
            <Card theme={theme}>
              <Step theme={theme} index={0} title="By model" hint="top 12" />
              {usage.data.byModel.map((entry) => (
                <Row key={entry.model} label={entry.model} theme={theme} value={`${entry.requests} req · $${entry.cost.toFixed(2)}`} />
              ))}
            </Card>
          ) : null}

          {spend.data?.byAccount.length ? (
            <Card theme={theme}>
              <Step
                theme={theme}
                index={0}
                title="By account"
                hint="who is spending the quota"
              />
              <Note theme={theme}>
                Rate limits are per account, so this is the row that explains a 429: the account at the top of this
                list is the one that hit its ceiling, even though every account shares the same model list.
              </Note>
              {spend.data.byAccount.map((entry) => (
                <Row
                  key={entry.label}
                  theme={theme}
                  label={entry.label}
                  value={`${entry.requests.toLocaleString()} req · ${Math.round(entry.promptTokens / 1e6)}M tok`}
                />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === "routing" ? (
        <>
          <Card theme={theme}>
            <Step theme={theme} index={0} title="CLI tools" hint="where each one actually sends traffic" />
            <Note theme={theme}>
              Direct provider access is a valid choice. Codex and Claude each use their own configuration. The separate 9Router provider in Paseo lets you choose routed models while keeping direct CLI settings. Change machine-wide routing only when you intend to use it for all launches.
            </Note>
            {!live ? <Note theme={theme} tone="warning">Finish Setup first.</Note> : null}
            {cliTools.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {cliTools.data?.tools.length === 0 ? <Note theme={theme}>No CLI tools detected.</Note> : null}
            {cliTools.data?.tools.map((tool) => (
              <View
                key={tool.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }}
              >
                <Text style={{ color: theme.colors.foreground, fontSize: 13, flex: 1 }}>{tool.label}</Text>
                <Chip
                  theme={theme}
                  label={!tool.installed ? "absent" : tool.routed ? "routed" : "bypassing"}
                  tone={!tool.installed ? "neutral" : tool.routed ? "success" : "warning"}
                />
              </View>
            ))}
            {cliTools.data?.tools.filter((tool) => tool.installed && !tool.routed).map((tool) => (
              <Note key={`${tool.id}-detail`} theme={theme} tone="warning">
                {tool.label}: {tool.detail}
              </Note>
            ))}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Prompt compaction" hint="pxpipe" />
            {pxpipe.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {pxpipe.data ? (
              <View style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: 13, flex: 1 }}>Status</Text>
                  <Chip
                    theme={theme}
                    label={pxpipe.data.running ? "running" : pxpipe.data.installed ? "idle" : "not installed"}
                    tone={pxpipe.data.running ? "success" : pxpipe.data.installed ? "neutral" : "neutral"}
                  />
                </View>
                <Note theme={theme}>{pxpipe.data.detail}</Note>
                {pxpipe.data.version ? <Row theme={theme} label="Version" value={pxpipe.data.version} /> : null}
                {pxpipe.data.mode ? <Row theme={theme} label="Mode" value={pxpipe.data.mode} /> : null}
              </View>
            ) : null}
          </Card>

          <Card theme={theme}>
            <Step theme={theme} index={0} title="Proxy pools and nodes" hint="outbound paths" />
            {proxyPools.isLoading ? <ActivityIndicator color={theme.colors.accent} /> : null}
            {proxyPools.data && proxyPools.data.pools.length === 0 && proxyPools.data.nodes.length === 0 ? (
              <Note theme={theme}>
                None configured — every request leaves from this machine directly. That is the normal setup; pools
                only matter when traffic has to exit somewhere else.
              </Note>
            ) : null}
            {proxyPools.data?.pools.map((pool) => (
              <Row
                key={pool.id}
                theme={theme}
                label={`Pool · ${pool.label}`}
                value={pool.detail}
                tone={pool.active ? "success" : undefined}
              />
            ))}
            {proxyPools.data?.nodes.map((node) => (
              <Row
                key={node.id}
                theme={theme}
                label={`Node · ${node.label}`}
                value={node.detail}
                tone={node.active ? "success" : undefined}
              />
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
