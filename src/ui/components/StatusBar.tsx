import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../theme.js';
import type { UpdateInfo } from '../../updates.js';

interface StatusBarProps {
  sessionCount: number;
  alertCount: number;
  version: string;
  updateInfo?: UpdateInfo | null;
}

const formatTime = (): string => new Date().toLocaleTimeString('en-GB', { hour12: false });

export const StatusBar: React.FC<StatusBarProps> = React.memo(({ sessionCount, alertCount, version, updateInfo }) => {
  const [timeStr, setTimeStr] = useState(formatTime);
  const lastRef = useRef(timeStr);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = formatTime();
      if (next !== lastRef.current) {
        lastRef.current = next;
        setTimeStr(next);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box borderStyle="single" borderColor={colors.border} paddingX={1} justifyContent="space-between">
      <Text color={colors.header} bold>
        agenttop v{version}
      </Text>
      <Text color={colors.text}>
        {sessionCount} session{sessionCount !== 1 ? 's' : ''}
      </Text>
      {alertCount > 0 && (
        <Text color={colors.error} bold>
          {alertCount} alert{alertCount !== 1 ? 's' : ''}
        </Text>
      )}
      {updateInfo?.available && <Text color={colors.secondary}>v{updateInfo.latest} available (u)</Text>}
      <Text color={colors.muted}>{timeStr}</Text>
    </Box>
  );
});
