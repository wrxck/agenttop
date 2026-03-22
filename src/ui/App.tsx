import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import type { CLIOptions } from '../discovery/types.js';
import type { Config } from '../config/store.js';
import { setNickname, clearNickname, saveConfig } from '../config/store.js';
import { installHooks } from '../hooks/installer.js';
import { installMcpConfig } from '../install-mcp.js';
import { checkForUpdate, installUpdate } from '../updates.js';
import type { UpdateInfo } from '../updates.js';
import { StatusBar } from './components/StatusBar.js';
import { SessionList } from './components/SessionList.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { AlertBar } from './components/AlertBar.js';
import { SessionDetail } from './components/SessionDetail.js';
import { SetupModal } from './components/SetupModal.js';
import { FooterBar } from './components/FooterBar.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import { useSessions } from './hooks/useSessions.js';
import { useActivityStream } from './hooks/useActivityStream.js';
import { useAlerts } from './hooks/useAlerts.js';
import { useTextInput } from './hooks/useTextInput.js';
import { colors } from './theme.js';

type Panel = 'sessions' | 'activity';
type InputMode = 'normal' | 'nickname' | 'filter';

interface AppProps {
  options: CLIOptions;
  config: Config;
  version: string;
  firstRun: boolean;
}

const matchKey = (binding: string, input: string, key: Record<string, unknown>): boolean => {
  if (binding === 'tab') return Boolean(key.tab);
  if (binding === 'shift+tab') return Boolean(key.shift && key.tab);
  if (binding === 'enter') return Boolean(key.return);
  return input === binding;
};

export const App: React.FC<AppProps> = ({ options, config: initialConfig, version, firstRun }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const [liveConfig, setLiveConfig] = useState(initialConfig);
  const kb = liveConfig.keybindings;

  const [activePanel, setActivePanel] = useState<Panel>('sessions');
  const [activityScroll, setActivityScroll] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>('normal');
  const [showSetup, setShowSetup] = useState(firstRun);
  const [filter, setFilter] = useState('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { sessions, selectedSession, selectedIndex, selectNext, selectPrev, refresh } = useSessions(
    options.allUsers,
    filter || undefined,
  );
  const events = useActivityStream(selectedSession, options.allUsers);
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
      setFilter(value);
      setInputMode('normal');
    },
    () => {
      setFilter('');
      setInputMode('normal');
    },
  );

  useEffect(() => {
    if (options.noUpdates || !liveConfig.updates.checkOnLaunch) return;
    try {
      const i = checkForUpdate();
      if (i.available) setUpdateInfo(i);
    } catch {
      /* */
    }
    const iv = setInterval(() => {
      try {
        const i = checkForUpdate();
        if (i.available) setUpdateInfo(i);
      } catch {
        /* */
      }
    }, liveConfig.updates.checkInterval);
    return () => clearInterval(iv);
  }, []);

  const alertHeight = options.noSecurity ? 0 : 6;
  const mainHeight = termHeight - 3 - alertHeight - 1 - (inputMode !== 'normal' ? 1 : 0);
  const viewportRows = mainHeight - 2;
  const maxScroll = Math.max(0, events.length - viewportRows);

  useEffect(() => {
    setActivityScroll(0);
  }, [selectedSession?.sessionId]);

  const handleSettingsClose = useCallback((updatedConfig: Config) => {
    setLiveConfig(updatedConfig);
    saveConfig(updatedConfig);
    setShowSettings(false);
  }, []);

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
    },
    [liveConfig],
  );

  const switchPanel = useCallback((_dir: 'next' | 'prev') => {
    setActivePanel((p) => (p === 'sessions' ? 'activity' : 'sessions'));
  }, []);

  useInput((input, key) => {
    if (showSetup || showSettings) return;

    if (inputMode === 'nickname') {
      nicknameInput.handleInput(input, key);
      return;
    }
    if (inputMode === 'filter') {
      if (key.escape) {
        setFilter('');
        setInputMode('normal');
        filterInput.cancel();
        return;
      }
      filterInput.handleInput(input, key);
      return;
    }

    if (matchKey(kb.quit, input, key)) {
      exit();
      return;
    }

    if (showDetail) {
      if (key.escape || key.return || key.leftArrow) {
        setShowDetail(false);
      }
      return;
    }

    if (matchKey(kb.detail, input, key) && selectedSession && activePanel === 'sessions') {
      setShowDetail(true);
      return;
    }

    if (matchKey(kb.panelNext, input, key) || key.rightArrow) {
      switchPanel('next');
      return;
    }
    if (matchKey(kb.panelPrev, input, key) || key.leftArrow) {
      switchPanel('prev');
      return;
    }

    if (matchKey(kb.nickname, input, key) && selectedSession) {
      setInputMode('nickname');
      nicknameInput.start(selectedSession.nickname || '');
      return;
    }
    if (matchKey(kb.clearNickname, input, key) && selectedSession) {
      clearNickname(selectedSession.sessionId);
      refresh();
      return;
    }
    if (matchKey(kb.filter, input, key)) {
      setInputMode('filter');
      filterInput.start(filter);
      return;
    }
    if (key.escape && filter) {
      setFilter('');
      return;
    }
    if (matchKey(kb.settings, input, key)) {
      setShowSettings(true);
      return;
    }
    if (matchKey(kb.update, input, key) && updateInfo?.available) {
      setUpdateStatus('updating...');
      installUpdate()
        .then(() => setUpdateStatus(`updated to v${updateInfo.latest} — restart to apply`))
        .catch(() => setUpdateStatus('update failed'));
      return;
    }

    if (activePanel === 'sessions') {
      if (matchKey(kb.navDown, input, key) || key.downArrow) selectNext();
      if (matchKey(kb.navUp, input, key) || key.upArrow) selectPrev();
    }
    if (activePanel === 'activity') {
      if (matchKey(kb.navUp, input, key) || key.upArrow) setActivityScroll((s) => Math.min(s + 1, maxScroll));
      if (matchKey(kb.navDown, input, key) || key.downArrow) setActivityScroll((s) => Math.max(s - 1, 0));
      if (matchKey(kb.scrollBottom, input, key) || key.end) setActivityScroll(0);
      if (matchKey(kb.scrollTop, input, key) || key.home) setActivityScroll(maxScroll);
    }
  });

  if (showSetup) {
    const steps = [];
    if (liveConfig.prompts.hook === 'pending')
      steps.push({
        title: 'Install Claude Code hook?',
        description: 'Adds a PostToolUse hook that blocks prompt injection attempts in real-time.',
      });
    if (liveConfig.prompts.mcp === 'pending')
      steps.push({
        title: 'Install MCP server?',
        description: 'Registers agenttop as an MCP server so Claude Code can query session status and alerts.',
      });
    if (steps.length === 0) {
      setShowSetup(false);
      return null;
    }
    return <SetupModal steps={steps} onComplete={handleSetupComplete} />;
  }

  if (showSettings) {
    return <SettingsMenu config={liveConfig} onClose={handleSettingsClose} />;
  }

  const rightPanel =
    showDetail && selectedSession ? (
      <SessionDetail session={selectedSession} focused={activePanel === 'activity'} height={mainHeight} />
    ) : (
      <ActivityFeed
        events={events}
        sessionSlug={selectedSession?.slug ?? null}
        focused={activePanel === 'activity'}
        height={mainHeight}
        scrollOffset={activityScroll}
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
          <Text color={colors.primary}>/</Text>
          <Text color={colors.bright}>{filterInput.value}</Text>
          <Text color={colors.muted}>_</Text>
        </Box>
      )}
      {inputMode === 'normal' && <FooterBar keybindings={kb} updateStatus={updateStatus} />}
    </Box>
  );
};
