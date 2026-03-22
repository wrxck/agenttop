import { useState, useCallback } from 'react';

import type { Config } from '../../config/store.js';
import { saveConfig } from '../../config/store.js';
import { installHooks } from '../../hooks/installer.js';
import { installMcpConfig } from '../../install-mcp.js';

export const useSetupFlow = (initialConfig: Config, firstRun: boolean) => {
  const [liveConfig, setLiveConfig] = useState(initialConfig);
  const [showSetup, setShowSetup] = useState(firstRun);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const handleSettingsClose = useCallback((c: Config) => {
    setLiveConfig(c);
    saveConfig(c);
    setShowSettings(false);
  }, []);

  const handleThemeMenuClose = useCallback((c: Config) => {
    setLiveConfig(c);
    saveConfig(c);
    setShowThemeMenu(false);
    setShowSettings(true);
  }, []);

  const handleOpenThemeMenu = useCallback(() => setShowThemeMenu(true), []);

  const handleSetupComplete = useCallback(
    (results: Array<'yes' | 'not_now' | 'dismiss'>) => {
      const nc = { ...liveConfig };
      const [hc, mc] = results;
      if (hc === 'yes') {
        try {
          installHooks();
        } catch {
          /**/
        }
        nc.prompts.hook = 'installed';
      } else if (hc === 'dismiss') nc.prompts.hook = 'dismissed';
      if (mc === 'yes') {
        try {
          installMcpConfig();
        } catch {
          /**/
        }
        nc.prompts.mcp = 'installed';
      } else if (mc === 'dismiss') nc.prompts.mcp = 'dismissed';
      saveConfig(nc);
      setShowSetup(false);
      if (nc.prompts.theme === 'pending') setShowThemePicker(true);
      else if (nc.prompts.tour === 'pending') setShowTour(true);
    },
    [liveConfig],
  );

  const handleThemePickerSelect = useCallback(
    (themeName: string) => {
      const nc = { ...liveConfig, theme: themeName, prompts: { ...liveConfig.prompts, theme: 'done' as const } };
      setLiveConfig(nc);
      saveConfig(nc);
      setShowThemePicker(false);
      if (nc.prompts.tour === 'pending') setShowTour(true);
    },
    [liveConfig],
  );

  const handleThemePickerSkip = useCallback(() => {
    setShowThemePicker(false);
    if (liveConfig.prompts.tour === 'pending') setShowTour(true);
  }, [liveConfig]);

  const handleThemePickerDismiss = useCallback(() => {
    const nc = { ...liveConfig, prompts: { ...liveConfig.prompts, theme: 'dismissed' as const } };
    setLiveConfig(nc);
    saveConfig(nc);
    setShowThemePicker(false);
    if (nc.prompts.tour === 'pending') setShowTour(true);
  }, [liveConfig]);

  const handleTourComplete = useCallback(() => {
    const nc = { ...liveConfig, prompts: { ...liveConfig.prompts, tour: 'done' as const } };
    setLiveConfig(nc);
    saveConfig(nc);
    setShowTour(false);
  }, [liveConfig]);

  const handleTourSkip = useCallback(() => {
    setShowTour(false);
  }, []);

  return {
    liveConfig,
    setLiveConfig,
    showSetup,
    setShowSetup,
    showThemePicker,
    showTour,
    showSettings,
    setShowSettings,
    showThemeMenu,
    handleSettingsClose,
    handleThemeMenuClose,
    handleOpenThemeMenu,
    handleSetupComplete,
    handleThemePickerSelect,
    handleThemePickerSkip,
    handleThemePickerDismiss,
    handleTourComplete,
    handleTourSkip,
  };
};
