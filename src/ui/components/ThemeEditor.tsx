import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ThemeDefinition, ThemeColors, ToolColors } from '../../config/themes.js';
import { COLOR_KEYS, TOOL_COLOR_KEYS } from '../../config/themes.js';
import { colors } from '../theme.js';

interface ThemeEditorProps {
  theme: ThemeDefinition;
  onSave: (theme: ThemeDefinition) => void;
  onCancel: () => void;
}

type EditTarget = { group: 'colors'; key: keyof ThemeColors } | { group: 'toolColors'; key: keyof ToolColors };

const ALL_KEYS: EditTarget[] = [
  ...COLOR_KEYS.map((key) => ({ group: 'colors' as const, key })),
  ...TOOL_COLOR_KEYS.map((key) => ({ group: 'toolColors' as const, key })),
];

const isValidHex = (v: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(v);

export const ThemeEditor: React.FC<ThemeEditorProps> = React.memo(({ theme, onSave, onCancel }) => {
  const [editColors, setEditColors] = useState<ThemeColors>({ ...theme.colors });
  const [editToolColors, setEditToolColors] = useState<ToolColors>({ ...theme.toolColors });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const currentTarget = ALL_KEYS[selectedIdx];
  const getCurrentValue = (t: EditTarget): string => (t.group === 'colors' ? editColors[t.key] : editToolColors[t.key]);

  useInput((input, key) => {
    if (editing) {
      if (key.escape) {
        setEditing(false);
        setInputValue('');
        return;
      }
      if (key.return) {
        const val = inputValue.startsWith('#') ? inputValue : `#${inputValue}`;
        if (isValidHex(val)) {
          if (currentTarget.group === 'colors') {
            setEditColors((c) => ({ ...c, [currentTarget.key]: val }));
          } else {
            setEditToolColors((c) => ({ ...c, [currentTarget.key]: val }));
          }
        }
        setEditing(false);
        setInputValue('');
        return;
      }
      if (key.backspace || key.delete) {
        setInputValue((v) => v.slice(0, -1));
        return;
      }
      if (input && input.length === 1 && /[0-9A-Fa-f#]/.test(input)) {
        setInputValue((v) => v + input);
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setSelectedIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIdx((i) => Math.min(ALL_KEYS.length - 1, i + 1));
      return;
    }

    if (key.return) {
      setEditing(true);
      setInputValue(getCurrentValue(currentTarget));
      return;
    }

    if (input === 's' || input === 'S') {
      onSave({ ...theme, colors: editColors, toolColors: editToolColors });
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={colors.header} bold>
          EDIT THEME: {theme.name}
        </Text>
        <Text color={colors.muted}>enter:edit s:save esc:cancel</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={colors.accent} bold>
          {' '}
          COLORS
        </Text>
      </Box>
      {COLOR_KEYS.map((k, i) => {
        const isSelected = selectedIdx === i;
        const value = editColors[k];
        const isEditingThis = editing && isSelected;
        return (
          <Box key={k}>
            <Text color={isSelected ? colors.primary : colors.text}>
              {isSelected ? '> ' : '  '} {k.padEnd(12)}
            </Text>
            <Text color={value}>{isEditingThis ? inputValue + '_' : value}</Text>
            <Text color={value}> {'\u2588\u2588'}</Text>
          </Box>
        );
      })}

      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.accent} bold>
          {' '}
          TOOL COLORS
        </Text>
      </Box>
      {TOOL_COLOR_KEYS.map((k, i) => {
        const realIdx = COLOR_KEYS.length + i;
        const isSelected = selectedIdx === realIdx;
        const value = editToolColors[k];
        const isEditingThis = editing && isSelected;
        return (
          <Box key={k}>
            <Text color={isSelected ? colors.primary : colors.text}>
              {isSelected ? '> ' : '  '} {k.padEnd(12)}
            </Text>
            <Text color={value}>{isEditingThis ? inputValue + '_' : value}</Text>
            <Text color={value}> {'\u2588\u2588'}</Text>
          </Box>
        );
      })}
    </Box>
  );
});
