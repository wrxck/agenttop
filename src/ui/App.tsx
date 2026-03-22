import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';

import type { CLIOptions, Session } from '../discovery/types.js';
import type { Config } from '../config/store.js';
import {
  setNickname,
  clearNickname,
  saveConfig,
  archiveSession,
  unarchiveSession,
  getArchived,
  purgeExpiredArchives,
  deleteSessionFiles,
} from '../config/store.js';
import { resolveTheme } from '../config/themes.js';
import { installHooks } from '../hooks/installer.js';
import { installMcpConfig } from '../install-mcp.js';
import { installUpdate } from '../updates.js';
import { StatusBar } from './components/StatusBar.js';
import { SessionList } from './components/SessionList.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { AlertBar } from './components/AlertBar.js';
import { SessionDetail } from './components/SessionDetail.js';
import { SetupModal } from './components/SetupModal.js';
import { FooterBar } from './components/FooterBar.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import { ThemeMenu } from './components/ThemeMenu.js';
import { ThemePickerModal } from './components/ThemePickerModal.js';
import { GuidedTour } from './components/GuidedTour.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { SplitPanel } from './components/SplitPanel.js';
import { useSessions } from './hooks/useSessions.js';
import { useActivityStream } from './hooks/useActivityStream.js';
import { useFilteredEvents } from './hooks/useFilteredEvents.js';
import { useAlerts } from './hooks/useAlerts.js';
import { useTextInput } from './hooks/useTextInput.js';
import { useKeyHandler } from './hooks/useKeyHandler.js';
import { useUpdateChecker } from './hooks/useUpdateChecker.js';
import { colors, applyTheme } from './theme.js';

export type Panel = 'sessions' | 'activity' | 'left' | 'right';

interface AppProps {
  options: CLIOptions;
  config: Config;
  version: string;
  firstRun: boolean;
}

export const App: React.FC<AppProps> = ({ options, config: initialConfig, version, firstRun }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const [liveConfig, setLiveConfig] = useState(initialConfig);
  const kb = liveConfig.keybindings;

  const [activePanel, setActivePanel] = useState<Panel>('sessions');
  const [activityScroll, setActivityScroll] = useState(0);
  const [inputMode, setInputMode] = useState<'normal' | 'nickname' | 'filter'>('normal');
  const [showSetup, setShowSetup] = useState(firstRun);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [filter, setFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [viewingArchive, setViewingArchive] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(
    null,
  );
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set(Object.keys(getArchived())));

  const [splitMode, setSplitMode] = useState(false);
  const [leftSession, setLeftSession] = useState<Session | null>(null);
  const [rightSession, setRightSession] = useState<Session | null>(null);
  const [leftScroll, setLeftScroll] = useState(0);
  const [rightScroll, setRightScroll] = useState(0);
  const [leftFilter, setLeftFilter] = useState('');
  const [rightFilter, setRightFilter] = useState('');
  const [leftShowDetail, setLeftShowDetail] = useState(false);
  const [rightShowDetail, setRightShowDetail] = useState(false);

  const refreshArchived = useCallback(() => setArchivedIds(new Set(Object.keys(getArchived()))), []);
  const updateInfo = useUpdateChecker(
    options.noUpdates,
    liveConfig.updates.checkOnLaunch,
    liveConfig.updates.checkInterval,
  );

  useEffect(() => {
    applyTheme(resolveTheme(liveConfig.theme, liveConfig.customThemes));
  }, [liveConfig.theme, liveConfig.customThemes]);

  const { sessions, selectedSession, selectedIndex, selectNext, selectPrev, refresh } = useSessions(
    options.allUsers,
    filter || undefined,
    archivedIds,
    viewingArchive,
  );

  const rawEvents = useActivityStream(splitMode ? null : selectedSession, options.allUsers);
  const leftRawEvents = useActivityStream(splitMode ? leftSession : null, options.allUsers);
  const rightRawEvents = useActivityStream(splitMode ? rightSession : null, options.allUsers);
  const events = useFilteredEvents(rawEvents, activityFilter);
  const leftEvents = useFilteredEvents(leftRawEvents, leftFilter);
  const rightEvents = useFilteredEvents(rightRawEvents, rightFilter);
  const { alerts } = useAlerts(!options.noSecurity, options.alertLevel, options.allUsers, liveConfig);

  const nicknameInput = useTextInput(
    (value) => {
      if (selectedSession && value.trim()) {
        setNickname(selectedSession.sessionId, value.trim());
        refresh();
      }
      setInputMode('normal');
    },
    () => setInputMode('normal'),
  );
  const filterInput = useTextInput(
    (value) => {
      if (activePanel === 'sessions') setFilter(value);
      else if (activePanel === 'left') setLeftFilter(value);
      else if (activePanel === 'right') setRightFilter(value);
      else setActivityFilter(value);
      setInputMode('normal');
    },
    () => {
      if (activePanel === 'sessions') setFilter('');
      else if (activePanel === 'left') setLeftFilter('');
      else if (activePanel === 'right') setRightFilter('');
      else setActivityFilter('');
      setInputMode('normal');
    },
  );

  useEffect(() => {
    purgeExpiredArchives();
    refreshArchived();
  }, []);
  useEffect(() => {
    setActivityScroll(0);
  }, [selectedSession?.sessionId]);

  const alertHeight = options.noSecurity ? 0 : 6;
  const mainHeight = termHeight - 3 - alertHeight - 1 - (inputMode !== 'normal' ? 1 : 0);
  const viewportRows = mainHeight - 2;

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

  const switchPanel = useCallback(
    (dir: 'next' | 'prev') => {
      if (splitMode) {
        const order: Panel[] = ['sessions', 'left', 'right'];
        setActivePanel((p) => {
          const idx = order.indexOf(p);
          if (idx === -1) return 'sessions';
          return dir === 'next' ? order[(idx + 1) % order.length] : order[(idx - 1 + order.length) % order.length];
        });
      } else {
        setActivePanel((p) => (p === 'sessions' ? 'activity' : 'sessions'));
      }
    },
    [splitMode],
  );

  const getActiveFilter = useCallback(() => {
    if (activePanel === 'sessions') return filter;
    if (activePanel === 'left') return leftFilter;
    if (activePanel === 'right') return rightFilter;
    return activityFilter;
  }, [activePanel, filter, leftFilter, rightFilter, activityFilter]);

  const clearSplitState = useCallback(() => {
    setSplitMode(false);
    setLeftSession(null);
    setRightSession(null);
    setLeftScroll(0);
    setRightScroll(0);
    setLeftFilter('');
    setRightFilter('');
    setLeftShowDetail(false);
    setRightShowDetail(false);
    setActivePanel('sessions');
  }, []);

  const resetPanel = useCallback((side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftSession(null);
      setLeftScroll(0);
      setLeftFilter('');
      setLeftShowDetail(false);
    } else {
      setRightSession(null);
      setRightScroll(0);
      setRightFilter('');
      setRightShowDetail(false);
    }
  }, []);

  useKeyHandler({
    kb,
    activePanel,
    splitMode,
    inputMode,
    showSetup,
    showSettings: showSettings || showThemeMenu || showThemePicker || showTour,
    showDetail,
    leftShowDetail,
    rightShowDetail,
    confirmAction,
    selectedSession,
    leftSession,
    rightSession,
    leftScroll,
    rightScroll,
    leftFilter,
    rightFilter,
    filter,
    activityFilter,
    viewingArchive,
    archivedIds,
    updateInfo,
    maxScroll: Math.max(0, events.length - viewportRows),
    leftMaxScroll: Math.max(0, leftEvents.length - viewportRows),
    rightMaxScroll: Math.max(0, rightEvents.length - viewportRows),
    exit,
    selectNext,
    selectPrev,
    refresh,
    switchPanel,
    clearSplitState,
    resetPanel,
    getActiveFilter,
    setActivePanel,
    setInputMode,
    setFilter,
    setActivityFilter,
    setLeftFilter,
    setRightFilter,
    setShowDetail,
    setLeftShowDetail,
    setRightShowDetail,
    setShowSettings,
    setViewingArchive,
    setSplitMode,
    setLeftSession,
    setRightSession,
    setLeftScroll,
    setRightScroll,
    setActivityScroll,
    setConfirmAction,
    setUpdateStatus,
    nicknameInput,
    filterInput,
    onNickname: (id) => {
      clearNickname(id);
      refresh();
    },
    onClearNickname: (id) => {
      clearNickname(id);
      refresh();
    },
    onArchive: (id) => {
      archiveSession(id);
      refreshArchived();
      refresh();
    },
    onUnarchive: (id) => {
      unarchiveSession(id);
      refreshArchived();
      refresh();
    },
    onDelete: (sess) =>
      setConfirmAction({
        title: 'Delete session?',
        message: `Delete ${sess.nickname || sess.slug}? Output files will be removed.`,
        onConfirm: () => {
          deleteSessionFiles(sess.outputFiles);
          clearNickname(sess.sessionId);
          if (archivedIds.has(sess.sessionId)) {
            unarchiveSession(sess.sessionId);
            refreshArchived();
          }
          refresh();
          setConfirmAction(null);
        },
      }),
    onUpdate: () => {
      setUpdateStatus('updating...');
      installUpdate()
        .then(() => setUpdateStatus(`updated to v${updateInfo?.latest} — restart to apply`))
        .catch(() => setUpdateStatus('update failed'));
    },
  });

  if (showSetup) {
    const steps = [
      ...(liveConfig.prompts.hook === 'pending'
        ? [
            {
              title: 'Install Claude Code hook?',
              description: 'Adds a PostToolUse hook that blocks prompt injection attempts in real-time.',
            },
          ]
        : []),
      ...(liveConfig.prompts.mcp === 'pending'
        ? [
            {
              title: 'Install MCP server?',
              description: 'Registers agenttop as an MCP server so Claude Code can query session status and alerts.',
            },
          ]
        : []),
    ];
    if (steps.length === 0) {
      setShowSetup(false);
      if (liveConfig.prompts.theme === 'pending') setShowThemePicker(true);
      else if (liveConfig.prompts.tour === 'pending') setShowTour(true);
      return null;
    }
    return <SetupModal steps={steps} onComplete={handleSetupComplete} />;
  }
  if (showThemePicker) {
    return (
      <ThemePickerModal
        onSelect={handleThemePickerSelect}
        onSkip={handleThemePickerSkip}
        onDismiss={handleThemePickerDismiss}
      />
    );
  }
  if (showTour) return <GuidedTour onComplete={handleTourComplete} onSkip={handleTourSkip} />;
  if (showThemeMenu) return <ThemeMenu config={liveConfig} onClose={handleThemeMenuClose} />;
  if (showSettings)
    return <SettingsMenu config={liveConfig} onClose={handleSettingsClose} onOpenThemeMenu={handleOpenThemeMenu} />;
  if (confirmAction) {
    return (
      <Box flexDirection="column" height={termHeight} justifyContent="center" alignItems="center">
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      </Box>
    );
  }

  const filterLabel =
    activePanel === 'sessions'
      ? 'sessions'
      : activePanel === 'left'
        ? 'left'
        : activePanel === 'right'
          ? 'right'
          : 'activity';
  const rightPanel = splitMode ? (
    <SplitPanel
      activePanel={activePanel}
      leftSession={leftSession}
      rightSession={rightSession}
      leftEvents={leftEvents}
      rightEvents={rightEvents}
      leftScroll={leftScroll}
      rightScroll={rightScroll}
      leftFilter={leftFilter}
      rightFilter={rightFilter}
      leftShowDetail={leftShowDetail}
      rightShowDetail={rightShowDetail}
      height={mainHeight}
    />
  ) : showDetail && selectedSession ? (
    <SessionDetail session={selectedSession} focused={activePanel === 'activity'} height={mainHeight} />
  ) : (
    <ActivityFeed
      events={events}
      sessionSlug={selectedSession?.slug ?? null}
      focused={activePanel === 'activity'}
      height={mainHeight}
      scrollOffset={activityScroll}
      filter={activityFilter || undefined}
    />
  );

  return (
    <Box flexDirection="column" height={termHeight}>
      <StatusBar sessionCount={sessions.length} alertCount={alerts.length} version={version} updateInfo={updateInfo} />
      <Box flexGrow={1} height={mainHeight}>
        <SessionList
          sessions={sessions}
          selectedIndex={selectedIndex}
          focused={activePanel === 'sessions'}
          filter={filter || undefined}
          viewingArchive={viewingArchive}
        />
        {rightPanel}
      </Box>
      {!options.noSecurity && <AlertBar alerts={alerts} />}
      {inputMode === 'nickname' && (
        <Box paddingX={1}>
          <Text color={colors.primary}>nickname: </Text>
          <Text color={colors.bright}>{nicknameInput.value}</Text>
          <Text color={colors.muted}>_</Text>
        </Box>
      )}
      {inputMode === 'filter' && (
        <Box paddingX={1}>
          <Text color={colors.muted}>{filterLabel}</Text>
          <Text color={colors.primary}>/</Text>
          <Text color={colors.bright}>{filterInput.value}</Text>
          <Text color={colors.muted}>_</Text>
        </Box>
      )}
      {inputMode === 'normal' && (
        <FooterBar keybindings={kb} updateStatus={updateStatus} viewingArchive={viewingArchive} splitMode={splitMode} />
      )}
    </Box>
  );
};
