import React from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = React.memo(({ title, message, onConfirm, onCancel }) => {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      onConfirm();
    } else if (input === 'n' || input === 'N' || key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={colors.warning}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      alignSelf="center"
    >
      <Text color={colors.warning} bold>
        {title}
      </Text>
      <Text color={colors.text}>{message}</Text>
      <Box marginTop={1}>
        <Text color={colors.muted}>[y] confirm [n/esc] cancel</Text>
      </Box>
    </Box>
  );
});
