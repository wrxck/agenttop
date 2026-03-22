import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import type { CLIOptions } from '../discovery/types.js';
import { StatusBar } from './components/StatusBar.js';
import { SessionList } from './components/SessionList.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { AlertBar } from './components/AlertBar.js';
import { useSessions } from './hooks/useSessions.js';
import { useActivityStream } from './hooks/useActivityStream.js';
import { useAlerts } from './hooks/useAlerts.js';

type Panel = 'sessions' | 'activity';

interface AppProps {
  options: CLIOptions;
}

export const App: React.FC<AppProps> = ({ options }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const [activePanel, setActivePanel] = useState<Panel>('sessions');
  const [activityScroll, setActivityScroll] = useState(0);

  const { sessions, selectedSession, selectedIndex, selectNext, selectPrev } = useSessions(options.allUsers);
  const events = useActivityStream(selectedSession, options.allUsers);
  const { alerts } = useAlerts(!options.noSecurity, options.alertLevel, options.allUsers);

  const alertHeight = options.noSecurity ? 0 : 6;
  const statusHeight = 3;
  const footerHeight = 1;
  const mainHeight = termHeight - statusHeight - alertHeight - footerHeight;
  const viewportRows = mainHeight - 2;
  const maxScroll = Math.max(0, events.length - viewportRows);

  useEffect(() => {
    setActivityScroll(0);
  }, [selectedSession?.sessionId]);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.tab) {
      setActivePanel((p) => (p === 'sessions' ? 'activity' : 'sessions'));
      return;
    }

    if (activePanel === 'sessions') {
      if (input === 'j' || key.downArrow) selectNext();
      if (input === 'k' || key.upArrow) selectPrev();
    }

    if (activePanel === 'activity') {
      if (input === 'k' || key.upArrow) {
        setActivityScroll((s) => Math.min(s + 1, maxScroll));
      }
      if (input === 'j' || key.downArrow) {
        setActivityScroll((s) => Math.max(s - 1, 0));
      }
      if (input === 'G' || key.end) {
        setActivityScroll(0);
      }
      if (input === 'g' || key.home) {
        setActivityScroll(maxScroll);
      }
    }
  });

  return (
    <Box flexDirection="column" height={termHeight}>
      <StatusBar sessionCount={sessions.length} alertCount={alerts.length} />

      <Box flexGrow={1} height={mainHeight}>
        <SessionList
          sessions={sessions}
          selectedIndex={selectedIndex}
          focused={activePanel === 'sessions'}
        />
        <ActivityFeed
          events={events}
          sessionSlug={selectedSession?.slug ?? null}
          focused={activePanel === 'activity'}
          height={mainHeight}
          scrollOffset={activityScroll}
        />
      </Box>

      {!options.noSecurity && <AlertBar alerts={alerts} />}

      <Box paddingX={1}>
        <Box marginRight={2}>
          <Text color="#5C6370">q:quit</Text>
        </Box>
        <Box marginRight={2}>
          <Text color="#5C6370">j/k:nav</Text>
        </Box>
        <Box marginRight={2}>
          <Text color="#5C6370">tab:panel</Text>
        </Box>
        {activePanel === 'activity' && (
          <Box marginRight={2}>
            <Text color="#5C6370">g/G:top/bottom</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
