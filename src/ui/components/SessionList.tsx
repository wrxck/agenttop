import React from 'react';
import { Box, Text } from 'ink';

import type { Session } from '../../discovery/types.js';
import { colors } from '../theme.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  focused: boolean;
  filter?: string;
}

const formatModel = (model: string): string => {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return model.slice(0, 8);
};

const formatProject = (project: string): string => {
  const parts = project.split('/');
  const last = parts[parts.length - 1] || project;
  return last.length > 18 ? last.slice(0, 17) + '\u2026' : last;
};

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const SessionList: React.FC<SessionListProps> = React.memo(({ sessions, selectedIndex, focused, filter }) => {
  return (
    <Box flexDirection="column" width={28} borderStyle="single" borderColor={focused ? colors.primary : colors.border}>
      <Box paddingX={1}>
        <Text color={colors.header} bold>
          SESSIONS
        </Text>
        {filter && <Text color={colors.muted}> [{filter}]</Text>}
      </Box>

      {sessions.length === 0 && (
        <Box paddingX={1} paddingY={1}>
          <Text color={colors.muted} italic>
            {filter ? 'No matching sessions' : 'No active sessions'}
          </Text>
        </Box>
      )}

      {sessions.map((session, i) => {
        const isSelected = i === selectedIndex;
        const indicator = isSelected ? '>' : ' ';
        const displayName = session.nickname || session.slug;
        const totalIn = session.usage.inputTokens + session.usage.cacheReadTokens;

        return (
          <Box key={session.sessionId} flexDirection="column" paddingX={1} paddingY={0}>
            <Text
              color={isSelected ? colors.bright : colors.text}
              bold={isSelected}
              backgroundColor={isSelected ? colors.selected : undefined}
            >
              {indicator} {displayName}
            </Text>
            {session.nickname && (
              <Text color={colors.muted}>
                {'  '}
                {session.slug}
              </Text>
            )}
            <Text color={colors.muted}>
              {'  '}
              {formatProject(session.project)} | {formatModel(session.model)}
            </Text>
            <Text color={colors.muted}>
              {'  '}CPU {session.cpu}% | {session.memMB}MB | {session.agentCount} ag
            </Text>
            <Text color={colors.muted}>
              {'  '}
              {formatTokens(totalIn)} in | {formatTokens(session.usage.outputTokens)} out
            </Text>
          </Box>
        );
      })}
    </Box>
  );
});
