import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ThemeDefinition } from '../../config/themes.js';
import { BUILTIN_THEMES } from '../../config/themes.js';
import { applyTheme } from '../theme.js';
import { colors } from '../theme.js';

interface ThemePickerModalProps {
  onSelect: (themeName: string) => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export const ThemePickerModal: React.FC<ThemePickerModalProps> = React.memo(({ onSelect, onSkip, onDismiss }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const themes = BUILTIN_THEMES;

  useEffect(() => {
    applyTheme(themes[selectedIndex]);
  }, [selectedIndex]);

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex((i) => Math.min(themes.length - 1, i + 1));
    if (key.return) onSelect(themes[selectedIndex].name);
    if (input === 'n') onSkip();
    if (input === 'd') onDismiss();
  });

  const renderSwatch = (theme: ThemeDefinition) => {
    const c = theme.colors;
    return (
      <Text>
        <Text color={c.primary}>{'\u2588'}</Text>
        <Text color={c.secondary}>{'\u2588'}</Text>
        <Text color={c.accent}>{'\u2588'}</Text>
        <Text color={c.warning}>{'\u2588'}</Text>
        <Text color={c.error}>{'\u2588'}</Text>
      </Text>
    );
  };

  return (
    <Box flexDirection="column" paddingX={4} paddingY={1}>
      <Box borderStyle="round" borderColor={colors.primary} flexDirection="column" paddingX={3} paddingY={1}>
        <Box marginBottom={1}>
          <Text color={colors.header} bold>
            Choose a theme
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={colors.text}>Select a theme to get started. You can change this later in settings (s).</Text>
        </Box>
        {themes.map((theme, i) => (
          <Box key={theme.name}>
            <Text color={i === selectedIndex ? colors.primary : colors.muted}>{i === selectedIndex ? '> ' : '  '}</Text>
            {renderSwatch(theme)}
            <Text color={i === selectedIndex ? colors.bright : colors.text}> {theme.name}</Text>
          </Box>
        ))}
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.muted}>Enter = select | n = not now | d = don't ask again</Text>
        </Box>
      </Box>
    </Box>
  );
});
