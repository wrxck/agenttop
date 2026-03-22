import React from 'react';
import { Box, Text } from 'ink';

import type { Session } from '../../discovery/types.js';
import { colors } from '../theme.js';

interface SessionDetailProps {
  session: Session;
  focused: boolean;
  height: number;
}

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

const formatUptime = (startTime: number): string => {
  const ms = Date.now() - startTime;
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
};

const formatModel = (model: string): string => {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return model.slice(0, 20);
};

export const SessionDetail: React.FC<SessionDetailProps> = React.memo(({ session, focused }) => {
  const totalInput = session.usage.inputTokens + session.usage.cacheCreationTokens + session.usage.cacheReadTokens;
  const totalTokens = totalInput + session.usage.outputTokens;
  const cacheHitRate = totalInput > 0 ? ((session.usage.cacheReadTokens / totalInput) * 100).toFixed(0) : '0';

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor={focused ? colors.primary : colors.border}
    >
      <Box paddingX={1}>
        <Text color={colors.header} bold>
          SESSION DETAIL
        </Text>
        <Text color={colors.muted}> (Esc to return)</Text>
      </Box>

      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box>
          <Text color={colors.muted}>{'slug:      '}</Text>
          <Text color={colors.bright} bold>
            {session.slug}
          </Text>
        </Box>
        {session.nickname && (
          <Box>
            <Text color={colors.muted}>{'nickname:  '}</Text>
            <Text color={colors.secondary}>{session.nickname}</Text>
          </Box>
        )}
        <Box>
          <Text color={colors.muted}>{'model:     '}</Text>
          <Text color={colors.text}>{formatModel(session.model)}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'cwd:       '}</Text>
          <Text color={colors.text}>{session.cwd}</Text>
        </Box>
        {session.gitBranch && (
          <Box>
            <Text color={colors.muted}>{'branch:    '}</Text>
            <Text color={colors.secondary}>{session.gitBranch}</Text>
          </Box>
        )}
        <Box>
          <Text color={colors.muted}>{'version:   '}</Text>
          <Text color={colors.text}>{session.version || 'unknown'}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'pid:       '}</Text>
          <Text color={colors.text}>{session.pid ?? 'not running'}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'cpu:       '}</Text>
          <Text color={colors.text}>{session.cpu}%</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'memory:    '}</Text>
          <Text color={colors.text}>{session.memMB}MB</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'uptime:    '}</Text>
          <Text color={colors.text}>{formatUptime(session.startTime)}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'agents:    '}</Text>
          <Text color={colors.text}>{session.agentCount}</Text>
        </Box>

        <Box marginTop={1}>
          <Text color={colors.header} bold>
            Token usage
          </Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'  input:       '}</Text>
          <Text color={colors.text}>{formatTokens(session.usage.inputTokens)}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'  output:      '}</Text>
          <Text color={colors.text}>{formatTokens(session.usage.outputTokens)}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'  cache write:  '}</Text>
          <Text color={colors.text}>{formatTokens(session.usage.cacheCreationTokens)}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'  cache read:   '}</Text>
          <Text color={colors.text}>{formatTokens(session.usage.cacheReadTokens)}</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'  cache hit:    '}</Text>
          <Text color={session.usage.cacheReadTokens > 0 ? colors.secondary : colors.text}>{cacheHitRate}%</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>{'  total:        '}</Text>
          <Text color={colors.bright} bold>
            {formatTokens(totalTokens)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
});
