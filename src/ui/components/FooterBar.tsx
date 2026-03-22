import React from 'react';
import { Box, Text } from 'ink';

import type { KeybindingsConfig } from '../../config/store.js';
import { colors } from '../theme.js';

interface FooterBarProps {
  keybindings: KeybindingsConfig;
  updateStatus?: string;
  viewingArchive?: boolean;
  splitMode?: boolean;
}

const label = (key: string): string => {
  if (key === 'tab') return 'tab';
  if (key === 'shift+tab') return 'S-tab';
  if (key === 'enter') return 'enter';
  return key;
};

export const FooterBar: React.FC<FooterBarProps> = React.memo(
  ({ keybindings, updateStatus, viewingArchive, splitMode }) => (
    <Box paddingX={1}>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.quit)}:quit</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>
          {label(keybindings.navDown)}/{label(keybindings.navUp)}:nav
        </Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.panelNext)}:panel</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.filter)}:filter</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.nickname)}:name</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.detail)}:detail</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>
          {label(keybindings.split)}:{splitMode ? 'unsplit' : 'split'}
        </Text>
      </Box>
      {splitMode && (
        <>
          <Box marginRight={2}>
            <Text color={colors.muted}>
              {label(keybindings.pinLeft)}/{label(keybindings.pinRight)}:pin
            </Text>
          </Box>
          <Box marginRight={2}>
            <Text color={colors.muted}>{label(keybindings.swapPanels)}:swap</Text>
          </Box>
        </>
      )}
      <Box marginRight={2}>
        <Text color={colors.muted}>
          {label(keybindings.archive)}:{viewingArchive ? 'restore' : 'archive'}
        </Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.delete)}:delete</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.viewArchive)}:archived</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={colors.muted}>{label(keybindings.settings)}:settings</Text>
      </Box>
      {updateStatus && (
        <Box marginRight={2}>
          <Text color={colors.secondary}>{updateStatus}</Text>
        </Box>
      )}
    </Box>
  ),
);
