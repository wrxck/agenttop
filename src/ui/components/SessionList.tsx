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

const formatProject = (project: string, max: number): string => {
  const parts = project.split('/');
  const last = parts[parts.length - 1] || project;
  return last.length > max ? last.slice(0, max - 1) + '\u2026' : last;
};

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + '\u2026' : s);

const SIDEBAR_WIDTH = 28;
const INNER_WIDTH = SIDEBAR_WIDTH - 4; // borders + paddingX

export const SessionList: React.FC<SessionListProps> = React.memo(({ sessions, selectedIndex, focused, filter }) => {
  return (
    <Box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      borderStyle="single"
      borderColor={focused ? colors.primary : colors.border}
      overflow="hidden"
    >
      <Box paddingX={1}>
        <Text color={colors.header} bold>
          SESSIONS
        </Text>
        {filter && <Text color={colors.muted}> [{truncate(filter, 10)}]</Text>}
      </Box>

      {sessions.length === 0 && (
        <Box paddingX={1} paddingY={1}>
          <Text color={colors.muted} italic>
            {filter ? 'No matches' : 'No sessions'}
          </Text>
        </Box>
      )}

      {sessions.map((session, i) => {
        const isSelected = i === selectedIndex;
        const indicator = isSelected ? '>' : ' ';
        const nameMaxLen = INNER_WIDTH - 2; // indicator + space
        const displayName = truncate(session.nickname || session.slug, nameMaxLen);
        const totalIn = session.usage.inputTokens + session.usage.cacheReadTokens;
        const proj = formatProject(session.project, 12);
        const model = formatModel(session.model);

        return (
          <Box key={session.sessionId} flexDirection="column" paddingX={1} paddingY={0}>
            <Text
              color={isSelected ? colors.bright : colors.text}
              bold={isSelected}
              backgroundColor={isSelected ? colors.selected : undefined}
              wrap="truncate"
            >
              {indicator} {displayName}
            </Text>
            {session.nickname && (
              <Text color={colors.muted} wrap="truncate">
                {'  '}
                {truncate(session.slug, nameMaxLen)}
              </Text>
            )}
            <Text color={colors.muted} wrap="truncate">
              {'  '}
              {proj} {model} {session.agentCount}ag
            </Text>
            <Text color={colors.muted} wrap="truncate">
              {'  '}
              {formatTokens(totalIn)}in {formatTokens(session.usage.outputTokens)}out {session.cpu}%
            </Text>
          </Box>
        );
      })}
    </Box>
  );
});
