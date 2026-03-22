import React from 'react';
import { Box, Text } from 'ink';

import type { Session } from '../../discovery/types.js';
import { colors } from '../theme.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  focused: boolean;
  height: number;
  filter?: string;
  viewingArchive?: boolean;
}

const formatModel = (model: string): string => {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'son';
  if (model.includes('haiku')) return 'hai';
  return model.slice(0, 4);
};

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + '\u2026' : s);

const SIDEBAR_WIDTH = 28;
const INNER_WIDTH = SIDEBAR_WIDTH - 4;

export const SessionList: React.FC<SessionListProps> = React.memo(
  ({ sessions, selectedIndex, focused, height, filter, viewingArchive }) => {
    const viewportRows = height - 2;
    const halfView = Math.floor(viewportRows / 2);
    const scrollStart = Math.max(0, Math.min(selectedIndex - halfView, sessions.length - viewportRows));
    const start = Math.max(0, scrollStart);
    const visible = sessions.slice(start, start + viewportRows);
    const canScroll = sessions.length > viewportRows;

    return (
      <Box
        flexDirection="column"
        width={SIDEBAR_WIDTH}
        borderStyle="single"
        borderColor={focused ? colors.primary : colors.border}
        overflow="hidden"
      >
        <Box paddingX={1} justifyContent="space-between">
          <Box>
            <Text color={viewingArchive ? colors.warning : colors.header} bold>
              {viewingArchive ? 'ARCHIVE' : 'SESSIONS'}
            </Text>
            {filter && <Text color={colors.muted}> [{truncate(filter, 8)}]</Text>}
          </Box>
          {canScroll && (
            <Text color={colors.muted}>
              {selectedIndex + 1}/{sessions.length}
            </Text>
          )}
        </Box>

        {sessions.length === 0 && (
          <Box paddingX={1} paddingY={1}>
            <Text color={colors.muted} italic>
              {filter ? 'No matches' : viewingArchive ? 'No archived' : 'No sessions'}
            </Text>
          </Box>
        )}

        {visible.map((session, vi) => {
          const realIdx = start + vi;
          const isSelected = realIdx === selectedIndex;
          const indicator = isSelected ? '>' : ' ';
          const nameMaxLen = INNER_WIDTH - 2;
          const displayName = truncate(session.nickname || session.slug, nameMaxLen);
          const totalIn = session.usage.inputTokens + session.usage.cacheReadTokens;
          const model = formatModel(session.model);
          const isActive = session.pid !== null;
          const nameColor = isSelected ? colors.bright : isActive ? colors.secondary : colors.text;

          return (
            <Box
              key={session.sessionId}
              flexDirection="column"
              paddingX={1}
              paddingY={0}
              backgroundColor={isSelected ? colors.selected : undefined}
            >
              <Text color={nameColor} bold={isSelected} wrap="truncate">
                {indicator} {displayName}
              </Text>
              <Text color={colors.muted} wrap="truncate">
                {'  '}
                {model} {formatTokens(totalIn)}in {formatTokens(session.usage.outputTokens)}out
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  },
);
