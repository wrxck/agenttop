import React from 'react';
import { Box, Text } from 'ink';

import type { KeybindingsConfig } from '../../config/store.js';
import { colors } from '../theme.js';

interface FooterBarProps {
  keybindings: KeybindingsConfig;
  updateStatus?: string;
  viewingArchive?: boolean;
}

const label = (key: string): string => {
  if (key === 'tab') return 'tab';
  if (key === 'shift+tab') return 'S-tab';
  if (key === 'enter') return 'enter';
  return key;
};

export const FooterBar: React.FC<FooterBarProps> = React.memo(({ keybindings, updateStatus, viewingArchive }) => (
  <Box paddingX={1}>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.quit)}:quit</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">
        {label(keybindings.navDown)}/{label(keybindings.navUp)}:nav
      </Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.panelNext)}:panel</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.filter)}:filter</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.nickname)}:name</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.detail)}:detail</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">
        {label(keybindings.archive)}:{viewingArchive ? 'restore' : 'archive'}
      </Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.delete)}:delete</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.viewArchive)}:archived</Text>
    </Box>
    <Box marginRight={2}>
      <Text color="#5C6370">{label(keybindings.settings)}:settings</Text>
    </Box>
    {updateStatus && (
      <Box marginRight={2}>
        <Text color={colors.secondary}>{updateStatus}</Text>
      </Box>
    )}
  </Box>
));
