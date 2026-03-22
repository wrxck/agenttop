import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';

import type { CLIOptions, ActivityEvent } from '../discovery/types.js';
import type { Config } from '../config/store.js';
import {
  setNickname,
  clearNickname,
  archiveSession,
  unarchiveSession,
  getArchived,
  purgeExpiredArchives,
  deleteSessionFiles,
  loadConfig,
  saveConfig,
  pinSession,
  unpinSession,
  movePinned,
} from '../config/store.js';
import { resolveTheme } from '../config/themes.js';
import { installUpdate, restartProcess } from '../updates.js';
import { StatusBar } from './components/StatusBar.js';
import { SessionList } from './components/SessionList.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { AlertBar } from './components/AlertBar.js';
import { SessionDetail } from './components/SessionDetail.js';
import { SetupModal } from './components/SetupModal.js';
import { FooterBar } from './components/FooterBar.js';
import { ToolCallDetail } from './components/ToolCallDetail.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import { ThemeMenu } from './components/ThemeMenu.js';
import { AlertRulesMenu } from './components/AlertRulesMenu.js';
import { ThemePickerModal } from './components/ThemePickerModal.js';
import { GuidedTour } from './components/GuidedTour.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { UpdateModal } from './components/UpdateModal.js';
import { SplitPanel } from './components/SplitPanel.js';
import { useSessions } from './hooks/useSessions.js';
import { useActivityStream } from './hooks/useActivityStream.js';
import { useFilteredEvents } from './hooks/useFilteredEvents.js';
import { useAlerts } from './hooks/useAlerts.js';
import { useTextInput } from './hooks/useTextInput.js';
import { useKeyHandler } from './hooks/useKeyHandler.js';
import { useUpdateChecker } from './hooks/useUpdateChecker.js';
import { useSetupFlow } from './hooks/useSetupFlow.js';
import { useSplitPanel } from './hooks/useSplitPanel.js';
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

  const setup = useSetupFlow(initialConfig, firstRun);
  const split = useSplitPanel();
  const kb = setup.liveConfig.keybindings;

  const [activePanel, setActivePanel] = useState<Panel>('sessions');
  const [activityScroll, setActivityScroll] = useState(0);
  const [inputMode, setInputMode] = useState<'normal' | 'nickname' | 'filter'>('normal');
  const [filter, setFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [viewingArchive, setViewingArchive] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(
    null,
  );
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set(Object.keys(getArchived())));
  const [sidebarWidth, setSidebarWidth] = useState(() => initialConfig.sidebarWidth ?? 30);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAlertRules, setShowAlertRules] = useState(false);

  const refreshArchived = useCallback(() => setArchivedIds(new Set(Object.keys(getArchived()))), []);

  const persistSidebarWidth = useCallback((v: number | ((w: number) => number)) => {
    setSidebarWidth((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (next !== prev) {
        const cfg = loadConfig();
        cfg.sidebarWidth = next;
        saveConfig(cfg);
      }
      return next;
    });
  }, []);
  const updateInfo = useUpdateChecker(
    options.noUpdates,
    setup.liveConfig.updates.checkOnLaunch,
    setup.liveConfig.updates.checkInterval,
  );

  useEffect(() => {
    applyTheme(resolveTheme(setup.liveConfig.theme, setup.liveConfig.customThemes));
  }, [setup.liveConfig.theme, setup.liveConfig.customThemes]);

  useEffect(() => {
    if (updateInfo?.available && setup.liveConfig.prompts.autoUpdate === 'pending') {
      setShowUpdateModal(true);
    }
  }, [updateInfo?.available, setup.liveConfig.prompts.autoUpdate]);

  const {
    sessions,
    visibleItems,
    selectedSession,
    selectedGroup,
    selectedIndex,
    selectNext,
    selectPrev,
    toggleExpand,
    refresh,
  } = useSessions(options.allUsers, filter || undefined, archivedIds, viewingArchive);

  const activityTarget = split.splitMode ? null : selectedGroup ? selectedGroup.sessions : selectedSession;
  const rawEvents = useActivityStream(activityTarget, options.allUsers);
  const leftRawEvents = useActivityStream(split.splitMode ? split.leftSession : null, options.allUsers);
  const rightRawEvents = useActivityStream(split.splitMode ? split.rightSession : null, options.allUsers);
  const events = useFilteredEvents(rawEvents, activityFilter);
  const leftEvents = useFilteredEvents(leftRawEvents, split.leftFilter);
  const rightEvents = useFilteredEvents(rightRawEvents, split.rightFilter);
  const { alerts } = useAlerts(!options.noSecurity, options.alertLevel, options.allUsers, setup.liveConfig);

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
      else if (activePanel === 'left') split.setLeftFilter(value);
      else if (activePanel === 'right') split.setRightFilter(value);
      else setActivityFilter(value);
      setInputMode('normal');
    },
    () => {
      if (activePanel === 'sessions') setFilter('');
      else if (activePanel === 'left') split.setLeftFilter('');
      else if (activePanel === 'right') split.setRightFilter('');
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
    setSelectedEventIndex(0);
    setShowEventDetail(false);
  }, [selectedSession?.sessionId, selectedGroup?.key]);

  // auto-scroll activity viewport to keep cursor visible
  useEffect(() => {
    const totalEvents = events.length;
    const vRows = termHeight - 3 - (options.noSecurity ? 0 : 6) - 1 - (inputMode !== 'normal' ? 1 : 0) - 2;
    if (vRows <= 0 || totalEvents === 0) return;
    const start = Math.max(0, totalEvents - vRows - activityScroll);
    const end = start + vRows;
    if (selectedEventIndex < start) {
      setActivityScroll(totalEvents - vRows - selectedEventIndex);
    } else if (selectedEventIndex >= end) {
      setActivityScroll(totalEvents - vRows - (selectedEventIndex - vRows + 1));
    }
  }, [selectedEventIndex, events.length]);

  // clamp selected index when events shrink
  useEffect(() => {
    if (events.length > 0 && selectedEventIndex >= events.length) {
      setSelectedEventIndex(events.length - 1);
    }
  }, [events.length]);

  const alertHeight = options.noSecurity ? 0 : 6;
  const mainHeight = termHeight - 3 - alertHeight - 1 - (inputMode !== 'normal' ? 1 : 0);
  const viewportRows = mainHeight - 2;

  const switchPanel = useCallback(
    (dir: 'next' | 'prev') => split.switchPanel(dir, setActivePanel),
    [split.switchPanel],
  );
  const clearSplitState = useCallback(() => {
    split.clearSplitState();
    setActivePanel('sessions');
  }, [split.clearSplitState]);

  const getActiveFilter = useCallback(() => {
    if (activePanel === 'sessions') return filter;
    if (activePanel === 'left') return split.leftFilter;
    if (activePanel === 'right') return split.rightFilter;
    return activityFilter;
  }, [activePanel, filter, split.leftFilter, split.rightFilter, activityFilter]);

  const handleTogglePin = useCallback(
    (sessionId: string) => {
      const cfg = loadConfig();
      if (cfg.pinnedSessions.includes(sessionId)) {
        unpinSession(sessionId);
      } else {
        pinSession(sessionId);
      }
      refresh();
    },
    [refresh],
  );

  const handleMovePinned = useCallback(
    (sessionId: string, dir: 'up' | 'down') => {
      movePinned(sessionId, dir);
      refresh();
    },
    [refresh],
  );

  useKeyHandler({
    kb,
    activePanel,
    splitMode: split.splitMode,
    inputMode,
    showSetup: setup.showSetup,
    showSettings:
      setup.showSettings || setup.showThemeMenu || setup.showThemePicker || setup.showTour || showAlertRules,
    showDetail,
    showEventDetail,
    leftShowDetail: split.leftShowDetail,
    rightShowDetail: split.rightShowDetail,
    confirmAction,
    showUpdateModal,
    selectedSession,
    selectedGroup,
    toggleExpand,
    leftSession: split.leftSession,
    rightSession: split.rightSession,
    leftScroll: split.leftScroll,
    rightScroll: split.rightScroll,
    leftFilter: split.leftFilter,
    rightFilter: split.rightFilter,
    filter,
    activityFilter,
    viewingArchive,
    archivedIds,
    updateInfo,
    maxScroll: Math.max(0, events.length - viewportRows),
    leftMaxScroll: Math.max(0, leftEvents.length - viewportRows),
    rightMaxScroll: Math.max(0, rightEvents.length - viewportRows),
    activityEventCount: events.length,
    selectedEventIndex,
    exit,
    selectNext,
    selectPrev,
    refresh,
    switchPanel,
    clearSplitState,
    resetPanel: split.resetPanel,
    getActiveFilter,
    setActivePanel,
    setInputMode,
    setFilter,
    setActivityFilter,
    setLeftFilter: split.setLeftFilter,
    setRightFilter: split.setRightFilter,
    setShowDetail,
    setLeftShowDetail: split.setLeftShowDetail,
    setRightShowDetail: split.setRightShowDetail,
    setShowSettings: setup.setShowSettings,
    showAlertRules,
    setShowAlertRules,
    setViewingArchive,
    setSplitMode: split.setSplitMode,
    setLeftSession: split.setLeftSession,
    setRightSession: split.setRightSession,
    setLeftScroll: split.setLeftScroll,
    setRightScroll: split.setRightScroll,
    setActivityScroll,
    setSelectedEventIndex,
    setShowEventDetail,
    setConfirmAction,
    setUpdateStatus,
    setSidebarWidth: persistSidebarWidth,
    nicknameInput,
    filterInput,
    onClearNickname: (id) => {
      clearNickname(id);
      refresh();
    },
    onTogglePin: handleTogglePin,
    onMovePinned: handleMovePinned,
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
        .then(() => {
          setUpdateStatus(`updated to v${updateInfo?.latest} — restarting...`);
          setTimeout(() => restartProcess(), 500);
        })
        .catch(() => setUpdateStatus('update failed'));
    },
  });

  if (setup.showSetup) {
    const steps = [
      ...(setup.liveConfig.prompts.hook === 'pending'
        ? [
            {
              title: 'Install Claude Code hook?',
              description: 'Adds a PostToolUse hook that blocks prompt injection attempts in real-time.',
            },
          ]
        : []),
      ...(setup.liveConfig.prompts.mcp === 'pending'
        ? [
            {
              title: 'Install MCP server?',
              description: 'Registers agenttop as an MCP server so Claude Code can query session status and alerts.',
            },
          ]
        : []),
    ];
    if (steps.length === 0) {
      setup.setShowSetup(false);
      return null;
    }
    return <SetupModal steps={steps} onComplete={setup.handleSetupComplete} />;
  }
  if (setup.showThemePicker)
    return (
      <ThemePickerModal
        onSelect={setup.handleThemePickerSelect}
        onSkip={setup.handleThemePickerSkip}
        onDismiss={setup.handleThemePickerDismiss}
      />
    );
  if (setup.showTour) return <GuidedTour onComplete={setup.handleTourComplete} onSkip={setup.handleTourSkip} />;
  if (setup.showThemeMenu) return <ThemeMenu config={setup.liveConfig} onClose={setup.handleThemeMenuClose} />;
  if (showAlertRules)
    return (
      <AlertRulesMenu
        config={setup.liveConfig}
        onClose={() => setShowAlertRules(false)}
        onSave={(newConfig) => {
          saveConfig(newConfig);
          setup.setLiveConfig(newConfig);
        }}
      />
    );
  if (setup.showSettings)
    return (
      <SettingsMenu
        config={setup.liveConfig}
        onClose={setup.handleSettingsClose}
        onOpenThemeMenu={setup.handleOpenThemeMenu}
      />
    );
  if (showUpdateModal && updateInfo?.available) {
    return (
      <Box flexDirection="column" height={termHeight} justifyContent="center" alignItems="center">
        <UpdateModal
          current={updateInfo.current}
          latest={updateInfo.latest}
          onNotNow={() => setShowUpdateModal(false)}
          onDontAskAgain={() => {
            const cfg = loadConfig();
            cfg.prompts.autoUpdate = 'dismissed';
            saveConfig(cfg);
            setup.setLiveConfig(cfg);
            setShowUpdateModal(false);
          }}
        />
      </Box>
    );
  }
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

  const activitySlug = selectedGroup ? selectedGroup.key : (selectedSession?.slug ?? null);
  const isMerged = selectedGroup !== null;

  const selectedEvent: ActivityEvent | undefined = events[selectedEventIndex];

  const rightPanel = split.splitMode ? (
    <SplitPanel
      activePanel={activePanel}
      leftSession={split.leftSession}
      rightSession={split.rightSession}
      leftEvents={leftEvents}
      rightEvents={rightEvents}
      leftScroll={split.leftScroll}
      rightScroll={split.rightScroll}
      leftFilter={split.leftFilter}
      rightFilter={split.rightFilter}
      leftShowDetail={split.leftShowDetail}
      rightShowDetail={split.rightShowDetail}
      height={mainHeight}
    />
  ) : showEventDetail && selectedEvent ? (
    <ToolCallDetail event={selectedEvent} focused={activePanel === 'activity'} height={mainHeight} />
  ) : showDetail && selectedSession ? (
    <SessionDetail session={selectedSession} focused={activePanel === 'activity'} height={mainHeight} />
  ) : (
    <ActivityFeed
      events={events}
      sessionSlug={activitySlug}
      sessionId={selectedSession?.sessionId}
      status={selectedGroup ? selectedGroup.status : selectedSession ? selectedSession.status : undefined}
      focused={activePanel === 'activity'}
      height={mainHeight}
      scrollOffset={activityScroll}
      filter={activityFilter || undefined}
      merged={isMerged}
      mergedSessions={selectedGroup?.sessions}
      selectedEventIndex={selectedEventIndex}
    />
  );

  return (
    <Box flexDirection="column" height={termHeight}>
      <StatusBar sessionCount={sessions.length} alertCount={alerts.length} version={version} updateInfo={updateInfo} />
      <Box flexGrow={1} height={mainHeight}>
        <SessionList
          visibleItems={visibleItems}
          selectedIndex={selectedIndex}
          focused={activePanel === 'sessions'}
          height={mainHeight}
          filter={filter || undefined}
          viewingArchive={viewingArchive}
          totalSessions={sessions.length}
          sidebarWidth={sidebarWidth}
        />
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          {rightPanel}
        </Box>
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
          <Text color={colors.muted}>
            {activePanel === 'sessions'
              ? 'sessions'
              : activePanel === 'left'
                ? 'left'
                : activePanel === 'right'
                  ? 'right'
                  : 'activity'}
          </Text>
          <Text color={colors.primary}>/</Text>
          <Text color={colors.bright}>{filterInput.value}</Text>
          <Text color={colors.muted}>_</Text>
        </Box>
      )}
      {inputMode === 'normal' && (
        <FooterBar
          keybindings={kb}
          updateStatus={updateStatus}
          viewingArchive={viewingArchive}
          splitMode={split.splitMode}
        />
      )}
    </Box>
  );
};
