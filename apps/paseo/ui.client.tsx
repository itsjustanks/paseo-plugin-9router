import React from "react";
import type { PluginTheme } from "@getpaseo/plugin";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { RouterStatus, Connection } from "./contracts.shared";
import { quotaTone, formatReset } from "./router.logic";
type Theme = PluginTheme;

export function Card({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 18,
        gap: 12,
        marginBottom: 16,
      }}
    >
      {children}
    </View>
  );
}

export function Step({ theme, index, title, hint }: { theme: Theme; index: number; title: string; hint?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {index > 0 ? <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: theme.colors.surface2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, fontWeight: "700" }}>{index}</Text>
      </View> : null}
      <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}>{title}</Text>
      {hint ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ theme, label, tone = "neutral" }: { theme: Theme; label: string; tone?: "success" | "warning" | "danger" | "neutral" }) {
  const color =
    tone === "success"
      ? theme.colors.statusSuccess
      : tone === "warning"
        ? theme.colors.statusWarning
        : tone === "danger"
          ? theme.colors.statusDanger
          : theme.colors.foregroundMuted;
  return (
    <View style={{ alignSelf: "flex-start", borderColor: color, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function Button({
  theme,
  label,
  onPress,
  tone = "default",
  busy,
  disabled,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  tone?: "default" | "primary" | "danger";
  busy?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || busy;
  const background = tone === "primary" ? theme.colors.accent : theme.colors.surface2;
  const color = tone === "primary" ? theme.colors.accentForeground : tone === "danger" ? theme.colors.statusDanger : theme.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={!!inactive}
      onPress={inactive ? undefined : onPress}
      style={{
        backgroundColor: background,
        borderColor: theme.colors.border,
        borderWidth: tone === "primary" ? 0 : 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 40,
        opacity: inactive ? 0.5 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : null}
      <Text style={{ color, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  theme,
  value,
  onChangeText,
  placeholder,
  secure,
}: {
  theme: Theme;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  secure?: boolean;
}) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.foregroundMuted}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
      style={{
        backgroundColor: theme.colors.surface0,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        color: theme.colors.foreground,
        fontSize: 13,
        minWidth: 0,
        width: "100%",
        flexGrow: 1,
      }}
    />
  );
}

export function Note({ theme, children, tone = "muted" }: { theme: Theme; children: React.ReactNode; tone?: "muted" | "warning" }) {
  return (
    <Text
      style={{
        color: tone === "warning" ? theme.colors.statusWarning : theme.colors.foregroundMuted,
        fontSize: 13,
        lineHeight: 19,
      }}
    >
      {children}
    </Text>
  );
}

export function QuotaBar({ theme, quota }: { theme: Theme; quota: RouterStatus["connections"][number]["usage"] extends null ? never : NonNullable<Connection["usage"]>["quotas"][number] }) {
  const tone = quotaTone(quota);
  const color =
    tone === "success"
      ? theme.colors.statusSuccess
      : tone === "warning"
        ? theme.colors.statusWarning
        : tone === "danger"
          ? theme.colors.statusDanger
          : theme.colors.foregroundMuted;
  const reset = formatReset(quota.resetAt);
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>{quota.label}</Text>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
          {quota.unlimited ? "unlimited" : `${Math.round(quota.remainingPercentage)}% left`}
          {reset ? ` · ${reset}` : ""}
        </Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(2, Math.min(100, quota.remainingPercentage))}%`, height: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

/**
 * The spend side of an account, rendered beside its quota bars.
 *
 * Plan quota and spend limit are enforced separately, so an account can read
 * 86% headroom on both bars and still refuse every request because its spend
 * cap is hit. Showing only the bars is how that state stays invisible.
 */
export function SpendRow({ theme, extra }: { theme: Theme; extra: NonNullable<NonNullable<Connection["usage"]>["extra"]> }) {
  const money = (value: number | null) =>
    value === null ? null : `${extra.currency ? `${extra.currency} ` : "$"}${value.toFixed(2)}`;
  const used = money(extra.usedCredits);
  const cap = money(extra.monthlyLimit);
  const blocked = extra.spendLimitReached;
  const pct = extra.utilization;
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11 }}>
          extra usage{extra.enabled ? "" : " (off)"}
        </Text>
        <Text
          style={{
            color: blocked ? theme.colors.statusDanger : theme.colors.foregroundMuted,
            fontSize: 11,
          }}
        >
          {used && cap ? `${used} of ${cap}` : pct !== null ? `${Math.round(pct)}% used` : "—"}
        </Text>
      </View>
      {pct !== null ? (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: "hidden" }}>
          <View
            style={{
              width: `${Math.max(2, Math.min(100, pct))}%`,
              height: 4,
              backgroundColor: blocked ? theme.colors.statusDanger : theme.colors.statusWarning,
            }}
          />
        </View>
      ) : null}
      {blocked ? (
        <Text style={{ color: theme.colors.statusDanger, fontSize: 11 }}>
          Spend limit reached — this account refuses requests even where the bars above show headroom.
          {extra.enabled ? "" : " Extra usage is switched off, so nothing can overflow into credits."}
        </Text>
      ) : null}
    </View>
  );
}

export function Toggle({
  theme,
  label,
  hint,
  on,
  busy,
  disabled,
  onToggle,
}: {
  theme: Theme;
  label: string;
  hint?: string;
  on: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>{label}</Text>
        <Chip theme={theme} label={on ? "on" : "off"} tone={on ? "success" : "neutral"} />
        <Button theme={theme} label={on ? "Turn off" : "Turn on"} busy={busy} disabled={disabled} onPress={onToggle} />
      </View>
      {hint ? <Note theme={theme}>{hint}</Note> : null}
    </View>
  );
}

export function Row({ theme, label, value, tone }: { theme: Theme; label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "success"
      ? theme.colors.statusSuccess
      : tone === "warning"
        ? theme.colors.statusWarning
        : tone === "danger"
          ? theme.colors.statusDanger
          : theme.colors.foreground;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

