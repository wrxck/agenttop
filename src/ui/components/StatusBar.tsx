import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../theme.js';

interface StatusBarProps {
  sessionCount: number;
  alertCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({ sessionCount, alertCount }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString('en-GB', { hour12: false });

  return (
    <Box borderStyle="single" borderColor={colors.border} paddingX={1} justifyContent="space-between">
      <Text color={colors.header} bold>
        agenttop v1.0.0
      </Text>
      <Text color={colors.text}>
        {sessionCount} session{sessionCount !== 1 ? 's' : ''}
      </Text>
      {alertCount > 0 && (
        <Text color={colors.error} bold>
          {alertCount} alert{alertCount !== 1 ? 's' : ''}
        </Text>
      )}
      <Text color={colors.muted}>{timeStr}</Text>
    </Box>
  );
};
