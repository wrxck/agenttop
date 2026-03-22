import React from 'react';
import { Box, Text } from 'ink';

import type { ActivityEvent, Session } from '../../discovery/types.js';
import { colors, getToolColor } from '../theme.js';

interface ActivityFeedProps {
  events: ActivityEvent[];
  sessionSlug: string | null;
  sessionId?: string;
  isActive?: boolean;
  focused: boolean;
  height: number;
  scrollOffset: number;
  filter?: string;
  merged?: boolean;
  mergedSessions?: Session[];
  selectedEventIndex?: number;
}

const TAG_COLORS = ['#61AFEF', '#98C379', '#C678DD', '#E5C07B', '#E06C75', '#56B6C2', '#D19A66', '#BE5046'];

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour12: false });
};

const summarizeInput = (call: ActivityEvent['call']): string => {
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
  ({
    events,
    sessionSlug,
    sessionId,
    isActive,
    focused,
    height,
    scrollOffset,
    filter,
    merged,
    mergedSessions,
    selectedEventIndex,
  }) => {
    const viewportRows = height - 2;
    const totalEvents = events.length;
    const start = Math.max(0, totalEvents - viewportRows - scrollOffset);
    const end = start + viewportRows;
    const visible = events.slice(start, end);

    const isAtBottom = scrollOffset === 0;
    const isAtTop = start === 0;
    const canScroll = totalEvents > viewportRows;

    const slugColorMap = new Map<string, string>();
    if (merged && mergedSessions) {
      mergedSessions.forEach((s, i) => {
        slugColorMap.set(s.sessionId, TAG_COLORS[i % TAG_COLORS.length]);
      });
    }

    const hasSelection = focused && selectedEventIndex !== undefined;

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
            {merged && <Text color={colors.accent}> [merged]</Text>}
            {filter && (
              <Text color={colors.muted}> [{filter.length > 10 ? filter.slice(0, 9) + '\u2026' : filter}]</Text>
            )}
          </Box>
          <Box>
            {hasSelection && <Text color={colors.muted}>enter:detail </Text>}
            {focused && canScroll && !isAtBottom && (
              <Text color={colors.muted}>
                [{totalEvents - end + viewportRows}/{totalEvents}]
              </Text>
            )}
          </Box>
        </Box>

        {visible.length === 0 && (
          <Box paddingX={1} paddingY={1}>
            <Text color={colors.muted} italic>
              {sessionSlug || merged ? 'Waiting for activity...' : 'Select a session'}
            </Text>
          </Box>
        )}

        {visible.map((event, i) => {
          const call = event.call;
          const globalIndex = start + i;
          const isSelected = hasSelection && globalIndex === selectedEventIndex;
          const tag = merged ? call.slug.slice(0, 4) : null;
          const tagColor = merged ? slugColorMap.get(call.sessionId) || colors.muted : undefined;

          return (
            <Box key={`${call.timestamp}-${i}`} paddingX={1}>
              {tag && <Text color={tagColor}>{tag.padEnd(5)}</Text>}
              <Text color={isSelected ? colors.bright : colors.muted} underline={isSelected}>
                {formatTime(call.timestamp)}
              </Text>
              <Text> </Text>
              <Text color={getToolColor(call.toolName)} bold underline={isSelected}>
                {call.toolName.padEnd(8)}
              </Text>
              <Text color={isSelected ? colors.bright : colors.text} underline={isSelected}>
                {' '}
                {summarizeInput(call)}
              </Text>
            </Box>
          );
        })}

        {focused && canScroll && !isAtTop && visible.length > 0 && (
          <Box paddingX={1} justifyContent="flex-end">
            <Text color={colors.muted}>{isAtBottom ? '' : 'G:bottom '}</Text>
          </Box>
        )}

        {!merged && sessionId && isActive === false && (
          <Box paddingX={1} flexDirection="column">
            <Text color={colors.muted}> </Text>
            <Text color={colors.muted}>
              resume: <Text color={colors.text}>claude --resume {sessionId}</Text>
            </Text>
          </Box>
        )}

        {merged && mergedSessions && mergedSessions.some((s) => s.pid === null) && (
          <Box paddingX={1} flexDirection="column">
            <Text color={colors.muted}> </Text>
            {mergedSessions
              .filter((s) => s.pid === null)
              .map((s) => (
                <Text key={s.sessionId} color={colors.muted}>
                  resume {s.slug.slice(0, 8)}: <Text color={colors.text}>claude --resume {s.sessionId}</Text>
                </Text>
              ))}
          </Box>
        )}
      </Box>
    );
  },
);
