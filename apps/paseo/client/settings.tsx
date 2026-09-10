import React, { useCallback, useMemo } from "react";
import { Text } from "react-native";
import { useSettings, type PluginSurfaceProps, type SettingsState } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsSection, SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { routingSettings, type RoutingSettings } from "../shared/settings";

type Ready = Extract<SettingsState<typeof routingSettings.schema>, { status: "ready" }>;

const RETRY_OPTIONS = [0, 1, 2, 3, 4, 5].map((count) => ({
  label: count === 0 ? "Never" : `${count} ${count === 1 ? "retry" : "retries"}`,
  value: String(count),
}));

/** Within the schema's 2..120 bounds; the default of 10 keeps the router idle between checks. */
const INTERVAL_OPTIONS = [2, 5, 10, 15, 30, 60, 120].map((minutes) => ({
  label: minutes < 60 ? `Every ${minutes} minutes` : minutes === 60 ? "Every hour" : `Every ${minutes / 60} hours`,
  value: String(minutes),
}));

function RoutingControls({ settings }: { settings: Ready }) {
  const values = settings.values;
  const update = useCallback(
    (patch: Partial<RoutingSettings>) => {
      void settings.save({ ...settings.values, ...patch }, settings.revision);
    },
    [settings],
  );
  return (
    <>
      <SettingsSection title="Paseo agents">
        <SettingsCard>
          <SettingsSwitch
            label="Route Paseo agents through 9router"
            hint="Claude sessions Paseo opens get 9router's URL and key in their environment. The machine-wide CLI config in Host setup is not touched, so Claude Code in a terminal keeps its direct connection."
            value={values.routeAgents}
            disabled={settings.saving}
            onValueChange={(routeAgents) => update({ routeAgents })}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Rate limits">
        <SettingsCard>
          <SettingsSwitch
            label="Reset backoff automatically"
            hint="When an agent's turn fails on a 429 or 'no available account', reset backoff on every account that can serve that model so the next request has somewhere to go."
            value={values.autoResetBackoff}
            disabled={settings.saving}
            onValueChange={(autoResetBackoff) => update({ autoResetBackoff })}
          />
          <SettingsSwitch
            label="Retry the turn after a reset"
            hint="Send 'Retry the last request.' to the agent once backoff is cleared. Only runs when automatic reset is on."
            value={values.retryOnRateLimit}
            disabled={settings.saving || !values.autoResetBackoff}
            onValueChange={(retryOnRateLimit) => update({ retryOnRateLimit })}
          />
          <SettingsSelect
            label="Automatic retries per agent"
            hint="Hard cap for the life of the plugin process, so a dead pool cannot loop an agent. Counts reset when the plugin reloads."
            value={String(values.maxRetriesPerAgent)}
            options={RETRY_OPTIONS}
            disabled={settings.saving || !values.retryOnRateLimit}
            onValueChange={(next) => update({ maxRetriesPerAgent: Number(next) })}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Account health">
        <SettingsCard>
          <SettingsSwitch
            label="Check account health in the background"
            hint="The plugin asks 9router for account backoff on a timer and caches the answer, so composer pills and panels read the cache instead of each hitting the router. Accounts stuck in backoff are logged and shown as stuck."
            value={values.healthChecks}
            disabled={settings.saving}
            onValueChange={(healthChecks) => update({ healthChecks })}
          />
          <SettingsSelect
            label="Check interval"
            hint="How often the background check runs. Opening a 9Router panel or surface still refreshes on demand."
            value={String(values.healthIntervalMinutes)}
            options={INTERVAL_OPTIONS}
            disabled={settings.saving || !values.healthChecks}
            onValueChange={(next) => update({ healthIntervalMinutes: Number(next) })}
          />
          <SettingsSwitch
            label="Show a 9Router pill in agent composers"
            hint="A small chip above the message box when something needs attention: accounts resting or stuck, no accounts ready, the router offline, or an agent bypassing an enabled pool. Healthy agents get no pill. Pressing it opens the 9Router accounts page."
            value={values.showComposerPill}
            disabled={settings.saving}
            onValueChange={(showComposerPill) => update({ showComposerPill })}
          />
        </SettingsCard>
      </SettingsSection>
    </>
  );
}

export function RoutingSettingsScreen({ theme }: PluginSurfaceProps) {
  const settings = useSettings(routingSettings);
  const style = useMemo(() => ({ color: theme.colors.foreground, fontSize: 13 }), [theme]);
  if (settings.status === "loading") return <Text style={style}>Loading routing settings…</Text>;
  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Routing">
        <Text accessibilityRole="alert" style={style}>{settings.error}</Text>
        <SettingsCard>
          <SettingsAction label="Try again" actionLabel="Reload" onPress={settings.reload} />
          {settings.status === "invalid" ? (
            <SettingsAction label="Restore default settings" actionLabel="Reset" onPress={settings.reset} />
          ) : null}
        </SettingsCard>
      </SettingsSection>
    );
  }
  return (
    <>
      <RoutingControls settings={settings} />
      {settings.saveError ? (
        <Text accessibilityRole="alert" style={{ ...style, color: theme.colors.statusDanger }}>{settings.saveError}</Text>
      ) : null}
    </>
  );
}
