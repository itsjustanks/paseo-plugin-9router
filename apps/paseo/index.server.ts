import { handleRouterAddAstra } from "./server/astra";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { routingSettings } from "./shared/settings";
import { registerRoutingHooks } from "./server/hooks";
import { handleRouterRoutingHealth, startRoutingHealthPoller } from "./server/health";
import { handleRouterAgentUsage, handleRouterTranscriptUsage, startTranscriptIndexPoller } from "./server/transcript-index";
import {
  routerAliasRemove,
  routerAliasSet,
  routerConnectComplete,
  routerConnectPoll,
  routerConnectStart,
  routerConnectionRemove,
  routerModelExpose,
  routerAddAstra,
  routerModelUnexpose,
  routerRouteCli,
  routerSettingsSave,
  routerStart,
  routerStatus,
  routerSyncModels,
  routerUsageStats,
  routerHolds,
  routerClearHold,
  routerComboCreate,
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
  routerDashboardOpen,
  routerLocalForward,
  routerLocalForwardStatus,
  routerLocalForwardStop,
  routerRequireApiKey,
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
  routerTestConnectionModels,
  routerThinkingCheck,
  routerUsageChart,
  routerHealth,
  routerRoutingHealth,
  routerTranscriptUsage,
  routerAgentUsage,
} from "./shared/contracts";
import {
  handleRouterAliasRemove,
  handleRouterAliasSet,
  handleRouterConnectComplete,
  handleRouterConnectPoll,
  handleRouterConnectStart,
  handleRouterConnectionRemove,
  handleRouterModelExpose,
  handleRouterModelUnexpose,
  handleRouterRouteCli,
  handleRouterSettingsSave,
  handleRouterStart,
  handleRouterStatus,
  handleRouterSyncModels,
  handleRouterUsageStats,
  handleRouterHolds,
  handleRouterClearHold,
  handleRouterComboCreate,
  handleRouterTestModel,
  handleRouterTuning,
  handleRouterTuningSet,
  handleRouterLogs,
  handleRouterKeys,
  handleRouterKeyCreate,
  handleRouterKeyDelete,
  handleRouterKeyReveal,
  handleRouterCombos,
  handleRouterComboSave,
  handleRouterComboDelete,
  handleRouterPasswordChange,
  handleRouterPowerUps,
  handleRouterPowerUpApply,
  handleRouterSyncSelection,
  handleRouterSyncSelectionSet,
  handleRouterTunnel,
  handleRouterTunnelSet,
  handleRouterDashboardOpen,
  handleRouterLocalForward,
  handleRouterLocalForwardStatus,
  handleRouterLocalForwardStop,
  handleRouterRequireApiKey,
  handleRouterCatalogSync,
  handleRouterConnectionHealth,
  handleRouterRequestLogs,
  handleRouterConnectionOrder,
  handleRouterConnectionPrioritySet,
  handleRouterConnectionActiveSet,
  handleRouterModelAvailability,
  handleRouterSpend,
  handleRouterCliTools,
  handleRouterProxyPools,
  handleRouterPxpipe,
  handleRouterStrategies,
  handleRouterStrategySet,
  handleRouterTailscale,
  handleRouterTailscaleAction,
  handleRouterVersion,
  handleRouterUpdate,
  handleRouterTestConnectionModels,
  handleRouterThinkingCheck,
  handleRouterUsageChart,
  handleRouterHealth,
} from "./server/handlers";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(routingSettings);
  registerRoutingHooks(server);
  const stopHealthPoller = startRoutingHealthPoller();
  // Transcript index: first scan 15s after startup so it never delays the plugin, then every 5 minutes incrementally.
  const stopTranscriptPoller = startTranscriptIndexPoller();
  server.handle(routerStatus, handleRouterStatus);
  server.handle(routerStart, handleRouterStart);
  server.handle(routerSettingsSave, handleRouterSettingsSave);
  server.handle(routerRouteCli, handleRouterRouteCli);
  server.handle(routerSyncModels, handleRouterSyncModels);
  server.handle(routerConnectStart, handleRouterConnectStart);
  server.handle(routerConnectPoll, handleRouterConnectPoll);
  server.handle(routerConnectComplete, handleRouterConnectComplete);
  server.handle(routerConnectionRemove, handleRouterConnectionRemove);
  server.handle(routerModelExpose, handleRouterModelExpose);
  server.handle(routerAddAstra, handleRouterAddAstra);
  server.handle(routerModelUnexpose, handleRouterModelUnexpose);
  server.handle(routerAliasSet, handleRouterAliasSet);
  server.handle(routerAliasRemove, handleRouterAliasRemove);
  server.handle(routerUsageStats, handleRouterUsageStats);
  server.handle(routerHolds, handleRouterHolds);
  server.handle(routerClearHold, handleRouterClearHold);
  server.handle(routerComboCreate, handleRouterComboCreate);
  server.handle(routerTestModel, handleRouterTestModel);
  server.handle(routerTuning, handleRouterTuning);
  server.handle(routerTuningSet, handleRouterTuningSet);
  server.handle(routerLogs, handleRouterLogs);
  server.handle(routerKeys, handleRouterKeys);
  server.handle(routerKeyCreate, handleRouterKeyCreate);
  server.handle(routerKeyDelete, handleRouterKeyDelete);
  server.handle(routerKeyReveal, handleRouterKeyReveal);
  server.handle(routerCombos, handleRouterCombos);
  server.handle(routerComboSave, handleRouterComboSave);
  server.handle(routerComboDelete, handleRouterComboDelete);
  server.handle(routerPasswordChange, handleRouterPasswordChange);
  server.handle(routerPowerUps, handleRouterPowerUps);
  server.handle(routerPowerUpApply, handleRouterPowerUpApply);
  server.handle(routerSyncSelection, handleRouterSyncSelection);
  server.handle(routerSyncSelectionSet, handleRouterSyncSelectionSet);
  server.handle(routerTunnel, handleRouterTunnel);
  server.handle(routerTunnelSet, handleRouterTunnelSet);
  server.handle(routerDashboardOpen, handleRouterDashboardOpen);
  server.handle(routerLocalForward, handleRouterLocalForward);
  server.handle(routerLocalForwardStop, handleRouterLocalForwardStop);
  server.handle(routerLocalForwardStatus, handleRouterLocalForwardStatus);
  server.handle(routerRequireApiKey, handleRouterRequireApiKey);
  server.handle(routerCatalogSync, handleRouterCatalogSync);
  server.handle(routerConnectionHealth, handleRouterConnectionHealth);
  server.handle(routerRequestLogs, handleRouterRequestLogs);
  server.handle(routerConnectionOrder, handleRouterConnectionOrder);
  server.handle(routerConnectionPrioritySet, handleRouterConnectionPrioritySet);
  server.handle(routerConnectionActiveSet, handleRouterConnectionActiveSet);
  server.handle(routerModelAvailability, handleRouterModelAvailability);
  server.handle(routerSpend, handleRouterSpend);
  server.handle(routerCliTools, handleRouterCliTools);
  server.handle(routerProxyPools, handleRouterProxyPools);
  server.handle(routerPxpipe, handleRouterPxpipe);
  server.handle(routerStrategies, handleRouterStrategies);
  server.handle(routerStrategySet, handleRouterStrategySet);
  server.handle(routerTailscale, handleRouterTailscale);
  server.handle(routerTailscaleAction, handleRouterTailscaleAction);
  server.handle(routerVersion, handleRouterVersion);
  server.handle(routerUpdate, handleRouterUpdate);
  server.handle(routerTestConnectionModels, handleRouterTestConnectionModels);
  server.handle(routerThinkingCheck, handleRouterThinkingCheck);
  server.handle(routerUsageChart, handleRouterUsageChart);
  server.handle(routerHealth, handleRouterHealth);
  server.handle(routerRoutingHealth, handleRouterRoutingHealth);
  server.handle(routerTranscriptUsage, handleRouterTranscriptUsage);
  server.handle(routerAgentUsage, handleRouterAgentUsage);
  return () => {
    stopHealthPoller();
    stopTranscriptPoller();
  };
}
