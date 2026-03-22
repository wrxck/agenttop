import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

import { installUpdate, restartProcess } from '../../updates.js';
import { colors } from '../theme.js';

type UpdateOption = 'now' | 'later' | 'never';

interface UpdateModalProps {
  current: string;
  latest: string;
  onNotNow: () => void;
  onDontAskAgain: () => void;
}

const options: { key: UpdateOption; label: string }[] = [
  { key: 'now', label: 'Update now' },
  { key: 'later', label: 'Not now' },
  { key: 'never', label: "Don't ask again" },
];

export const UpdateModal: React.FC<UpdateModalProps> = React.memo(({ current, latest, onNotNow, onDontAskAgain }) => {
  const [selected, setSelected] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'updating' | 'restarting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const doUpdate = useCallback(() => {
    setStatus('updating');
    installUpdate()
      .then(() => {
        setStatus('restarting');
        setTimeout(() => restartProcess(), 500);
      })
      .catch((err: Error) => {
        setErrorMsg(err.message || 'update failed');
        setStatus('error');
      });
  }, []);

  useInput((input, key) => {
    if (status === 'updating' || status === 'restarting') return;

    if (status === 'error') {
      if (key.escape || key.return) {
        setStatus('idle');
        setErrorMsg('');
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelected((s) => (s > 0 ? s - 1 : options.length - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelected((s) => (s < options.length - 1 ? s + 1 : 0));
      return;
    }
    if (key.escape) {
      onNotNow();
      return;
    }
    if (key.return) {
      const choice = options[selected]!.key;
      if (choice === 'now') {
        doUpdate();
      } else if (choice === 'later') {
        onNotNow();
      } else {
        onDontAskAgain();
      }
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={colors.primary}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      alignSelf="center"
    >
      <Text color={colors.primary} bold>
        Update available
      </Text>
      <Text color={colors.text}>
        v{current} {'->'} v{latest}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {status === 'updating' ? (
          <Text color={colors.warning}>updating...</Text>
        ) : status === 'restarting' ? (
          <Text color={colors.secondary}>restarting...</Text>
        ) : status === 'error' ? (
          <>
            <Text color={colors.error}>{errorMsg}</Text>
            <Text color={colors.muted}>press enter to continue</Text>
          </>
        ) : (
          options.map((opt, i) => (
            <Text key={opt.key} color={i === selected ? colors.primary : colors.muted}>
              {i === selected ? '> ' : '  '}
              {opt.label}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
});
