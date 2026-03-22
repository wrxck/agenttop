import React from 'react';
import { Box, Text } from 'ink';

import type { ToolCall } from '../../discovery/types.js';
import { colors, getToolColor } from '../theme.js';

interface ActivityFeedProps {
  events: ToolCall[];
  sessionSlug: string | null;
  sessionId?: string;
  isActive?: boolean;
  focused: boolean;
  height: number;
  scrollOffset: number;
  filter?: string;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour12: false });
};

const summarizeInput = (call: ToolCall): string => {
  const input = call.toolInput;

  switch (call.toolName) {
    case 'Bash':
      return String(input.command || '').slice(0, 50);
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(input.file_path || '')
        .split('/')
        .slice(-2)
        .join('/');
    case 'Grep':
      return `pattern="${String(input.pattern || '').slice(0, 30)}"`;
    case 'Glob':
      return String(input.pattern || '').slice(0, 40);
    case 'Task':
      return String(input.description || '').slice(0, 40);
    case 'WebFetch':
    case 'WebSearch':
      return String(input.url || input.query || '').slice(0, 40);
    default:
      return JSON.stringify(input).slice(0, 40);
  }
};

export const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(
  ({ events, sessionSlug, sessionId, isActive, focused, height, scrollOffset, filter }) => {
    const viewportRows = height - 2;
    const totalEvents = events.length;
    const start = Math.max(0, totalEvents - viewportRows - scrollOffset);
    const end = start + viewportRows;
    const visible = events.slice(start, end);

    const isAtBottom = scrollOffset === 0;
    const isAtTop = start === 0;
    const canScroll = totalEvents > viewportRows;

    return (
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={focused ? colors.primary : colors.border}
      >
        <Box paddingX={1} justifyContent="space-between">
          <Box>
            <Text color={colors.header} bold>
              ACTIVITY
            </Text>
            {sessionSlug && <Text color={colors.muted}> ({sessionSlug})</Text>}
            {filter && (
              <Text color={colors.muted}> [{filter.length > 10 ? filter.slice(0, 9) + '\u2026' : filter}]</Text>
            )}
          </Box>
          {focused && canScroll && !isAtBottom && (
            <Text color={colors.muted}>
              [{totalEvents - end + viewportRows}/{totalEvents}]
            </Text>
          )}
        </Box>

        {visible.length === 0 && (
          <Box paddingX={1} paddingY={1}>
            <Text color={colors.muted} italic>
              {sessionSlug ? 'Waiting for activity...' : 'Select a session'}
            </Text>
          </Box>
        )}

        {visible.map((event, i) => (
          <Box key={`${event.timestamp}-${i}`} paddingX={1}>
            <Text color={colors.muted}>{formatTime(event.timestamp)} </Text>
            <Text color={getToolColor(event.toolName)} bold>
              {event.toolName.padEnd(8)}
            </Text>
            <Text color={colors.text}> {summarizeInput(event)}</Text>
          </Box>
        ))}

        {focused && canScroll && !isAtTop && visible.length > 0 && (
          <Box paddingX={1} justifyContent="flex-end">
            <Text color={colors.muted}>{isAtBottom ? '' : 'G:bottom '}</Text>
          </Box>
        )}

        {sessionId && isActive === false && (
          <Box paddingX={1} flexDirection="column">
            <Text color={colors.muted}> </Text>
            <Text color={colors.muted}>
              resume: <Text color={colors.text}>claude --resume {sessionId}</Text>
            </Text>
          </Box>
        )}
      </Box>
    );
  },
);
