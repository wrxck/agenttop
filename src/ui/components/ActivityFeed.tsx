import React from 'react';
import { Box, Text } from 'ink';

import type { ToolCall } from '../../discovery/types.js';
import { colors } from '../theme.js';
import { getToolColor } from '../theme.js';

interface ActivityFeedProps {
  events: ToolCall[];
  sessionSlug: string | null;
  focused: boolean;
  height: number;
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
      return String(input.file_path || '').split('/').slice(-2).join('/');
    case 'Write':
      return String(input.file_path || '').split('/').slice(-2).join('/');
    case 'Edit':
      return String(input.file_path || '').split('/').slice(-2).join('/');
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

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events, sessionSlug, focused, height }) => {
  const visible = events.slice(-(height - 2));

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor={focused ? colors.primary : colors.border}
    >
      <Box paddingX={1}>
        <Text color={colors.header} bold>
          ACTIVITY
        </Text>
        {sessionSlug && (
          <Text color={colors.muted}> ({sessionSlug})</Text>
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
    </Box>
  );
};
