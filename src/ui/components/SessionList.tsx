import React from 'react';
import { Box, Text } from 'ink';

import type { VisibleItem } from '../../discovery/types.js';
import { colors } from '../theme.js';
import { formatTokens, formatModelShort as formatModel } from '../format.js';

interface SessionListProps {
  visibleItems: VisibleItem[];
  selectedIndex: number;
  focused: boolean;
  height: number;
  filter?: string;
  viewingArchive?: boolean;
  totalSessions: number;
  sidebarWidth?: number;
}

const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + '\u2026' : s);

const getDisplayName = (s: { nickname?: string; cwd: string; project: string; slug: string }): string => {
  if (s.nickname) return s.nickname;
  if (s.cwd) {
    const parts = s.cwd.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || s.slug;
  }
  if (s.project) {
    const parts = s.project.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || s.slug;
  }
  return s.slug;
};

const DEFAULT_SIDEBAR_WIDTH = 30;
const LINES_PER_ITEM = 3;

export const SessionList: React.FC<SessionListProps> = React.memo(
  ({ visibleItems, selectedIndex, focused, height, filter, viewingArchive, totalSessions, sidebarWidth }) => {
    const SIDEBAR_WIDTH = sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
    const INNER_WIDTH = SIDEBAR_WIDTH - 4;
    const availableRows = height - 2;
    const maxVisible = Math.max(1, Math.floor((availableRows + 1) / LINES_PER_ITEM));
    const halfView = Math.floor(maxVisible / 2);
    const scrollStart = Math.max(0, Math.min(selectedIndex - halfView, visibleItems.length - maxVisible));
    const start = Math.max(0, scrollStart);
    const visible = visibleItems.slice(start, start + maxVisible);
    const canScroll = visibleItems.length > maxVisible;

    return (
      <Box
        flexDirection="column"
        width={SIDEBAR_WIDTH}
        flexShrink={0}
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
              {selectedIndex + 1}/{visibleItems.length}
            </Text>
          )}
          {!canScroll && totalSessions > 0 && <Text color={colors.muted}>{totalSessions}</Text>}
        </Box>

        {visibleItems.length === 0 && (
          <Box paddingX={1} paddingY={1}>
            <Text color={colors.muted} italic>
              {filter ? 'No matches' : viewingArchive ? 'No archived' : 'No sessions'}
            </Text>
          </Box>
        )}

        {visible.map((item, vi) => {
          const realIdx = start + vi;
          const isSelected = realIdx === selectedIndex;

          if (item.type === 'group') {
            const g = item.group;
            const arrow = g.expanded ? '\u25be' : '\u25b8';
            const dotColor = g.isActive ? colors.success : colors.muted;
            const statusDot = g.isActive ? '\u25cf' : '\u25cb';
            const nameColor = isSelected ? colors.bright : g.isActive ? colors.secondary : colors.text;
            const label = truncate(`${g.key} (${g.sessions.length})`, INNER_WIDTH - 4);
            const model = formatModel(g.latestModel);

            return (
              <Box
                key={`group-${g.key}`}
                flexDirection="column"
                paddingX={1}
                backgroundColor={isSelected ? colors.selected : undefined}
              >
                <Text color={nameColor} bold={isSelected} underline={isSelected} wrap="truncate">
                  {arrow} <Text color={dotColor}>{statusDot}</Text> {label}
                </Text>
                <Text color={isSelected ? colors.text : colors.muted} wrap="truncate">
                  {'    '}
                  {model} {formatTokens(g.totalInputTokens)}in {formatTokens(g.totalOutputTokens)}out
                </Text>
                {vi < visible.length - 1 && <Text color={colors.border}>{'\u2500'.repeat(INNER_WIDTH)}</Text>}
              </Box>
            );
          }

          const session = item.type === 'session' ? item.session : item.session;
          const isActive = session.pid !== null;
          const statusDot = isActive ? '\u25cf' : '\u25cb';
          const dotColor = isActive ? colors.success : colors.muted;
          const totalIn = session.usage.inputTokens + session.usage.cacheReadTokens;
          const model = formatModel(session.model);

          if (item.type === 'session') {
            const nameColor = isSelected ? colors.bright : isActive ? colors.secondary : colors.muted;
            const displayName = truncate(session.nickname || session.slug, INNER_WIDTH - 6);
            return (
              <Box
                key={session.sessionId}
                flexDirection="column"
                paddingX={1}
                backgroundColor={isSelected ? colors.selected : undefined}
              >
                <Text color={nameColor} bold={isSelected} underline={isSelected} wrap="truncate">
                  {'  '} <Text color={dotColor}>{statusDot}</Text> {displayName}
                </Text>
                <Text color={isSelected ? colors.text : colors.muted} wrap="truncate">
                  {'      '}
                  {model} {formatTokens(totalIn)}in {formatTokens(session.usage.outputTokens)}out
                </Text>
                {vi < visible.length - 1 && <Text color={colors.border}>{'\u2500'.repeat(INNER_WIDTH)}</Text>}
              </Box>
            );
          }

          // ungrouped
          const indicator = isSelected ? '\u25b8' : ' ';
          const nameColor = isSelected ? colors.bright : isActive ? colors.secondary : colors.text;
          const displayName = truncate(getDisplayName(session), INNER_WIDTH - 4);

          return (
            <Box
              key={session.sessionId}
              flexDirection="column"
              paddingX={1}
              backgroundColor={isSelected ? colors.selected : undefined}
            >
              <Text color={nameColor} bold={isSelected} underline={isSelected} wrap="truncate">
                {indicator} <Text color={dotColor}>{statusDot}</Text> {displayName}
              </Text>
              <Text color={isSelected ? colors.text : colors.muted} wrap="truncate">
                {'    '}
                {model} {formatTokens(totalIn)}in {formatTokens(session.usage.outputTokens)}out
              </Text>
              {vi < visible.length - 1 && <Text color={colors.border}>{'\u2500'.repeat(INNER_WIDTH)}</Text>}
            </Box>
          );
        })}
      </Box>
    );
  },
);
