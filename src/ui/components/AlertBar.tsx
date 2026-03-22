import React from 'react';
import { Box, Text } from 'ink';

import type { Alert } from '../../discovery/types.js';
import { colors, severityColors } from '../theme.js';

interface AlertBarProps {
  alerts: Alert[];
  maxVisible?: number;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour12: false });
};

const severityIcon: Record<string, string> = {
  info: 'i',
  warn: '!',
  high: '!!',
  critical: '!!!',
};

export const AlertBar: React.FC<AlertBarProps> = React.memo(({ alerts, maxVisible = 4 }) => {
  const visible = alerts.slice(-maxVisible);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={alerts.length > 0 ? colors.error : colors.border}>
      <Box paddingX={1}>
        <Text color={colors.error} bold>
          ALERTS
        </Text>
        {alerts.length === 0 && <Text color={colors.muted}> (none)</Text>}
      </Box>

      {visible.map((alert, i) => (
        <Box key={alert.id || i} paddingX={1}>
          <Text color={severityColors[alert.severity] || colors.text}>[{severityIcon[alert.severity] || '?'}]</Text>
          <Text color={colors.muted}> {formatTime(alert.timestamp)} </Text>
          <Text color={colors.warning}>{alert.sessionSlug}: </Text>
          <Text color={colors.text}>{alert.message.slice(0, 60)}</Text>
        </Box>
      ))}
    </Box>
  );
});
