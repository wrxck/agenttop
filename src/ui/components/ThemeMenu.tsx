import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import type { ThemeDefinition } from '../../config/themes.js';
import { getAllThemes, getDefaultTheme, resolveTheme } from '../../config/themes.js';
import type { Config } from '../../config/store.js';
import { colors, applyTheme } from '../theme.js';
import { ThemeEditor } from './ThemeEditor.js';

interface ThemeMenuProps {
  config: Config;
  onClose: (updatedConfig: Config) => void;
}

type View = 'list' | 'editor' | 'naming';

export const ThemeMenu: React.FC<ThemeMenuProps> = React.memo(({ config, onClose }) => {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const [localConfig, setLocalConfig] = useState<Config>(() => JSON.parse(JSON.stringify(config)));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView] = useState<View>('list');
  const [editingTheme, setEditingTheme] = useState<ThemeDefinition | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [namingAction, setNamingAction] = useState<'copy' | 'rename'>('copy');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const themes = getAllThemes(localConfig.customThemes);

  const previewTheme = useCallback(
    (idx: number) => {
      const t = themes[idx];
      if (t) applyTheme(t);
    },
    [themes],
  );

  const updateSelection = useCallback(
    (newIdx: number) => {
      setSelectedIdx(newIdx);
      previewTheme(newIdx);
    },
    [previewTheme],
  );

  useInput((input, key) => {
    if (view === 'naming') {
      if (key.escape) {
        setView('list');
        setNameInput('');
        return;
      }
      if (key.return && nameInput.trim()) {
        const name = nameInput.trim();
        if (themes.some((t) => t.name === name)) {
          showToast(`Theme '${name}' already exists`);
          return;
        }
        if (namingAction === 'copy') {
          const source = themes[selectedIdx];
          const newTheme: ThemeDefinition = {
            name,
            colors: { ...source.colors },
            toolColors: { ...source.toolColors },
          };
          setLocalConfig((c) => ({
            ...c,
            theme: name,
            customThemes: {
              ...c.customThemes,
              [name]: { name, colors: newTheme.colors, toolColors: newTheme.toolColors },
            },
          }));
          applyTheme(newTheme);
          showToast(`Created '${name}'`);
        } else {
          const old = themes[selectedIdx];
          const updated = { ...localConfig.customThemes };
          delete updated[old.name];
          updated[name] = { name, colors: old.colors, toolColors: old.toolColors };
          const newActive = localConfig.theme === old.name ? name : localConfig.theme;
          setLocalConfig((c) => ({ ...c, theme: newActive, customThemes: updated }));
          showToast(`Renamed to '${name}'`);
        }
        setView('list');
        setNameInput('');
        return;
      }
      if (key.backspace || key.delete) {
        setNameInput((v) => v.slice(0, -1));
        return;
      }
      if (input && input.length === 1) setNameInput((v) => v + input);
      return;
    }

    if (view === 'editor' && editingTheme) return;

    if (key.escape) {
      const restoreTheme = resolveTheme(localConfig.theme, localConfig.customThemes);
      applyTheme(restoreTheme);
      onClose(localConfig);
      return;
    }

    if (key.upArrow) {
      updateSelection(Math.max(0, selectedIdx - 1));
      return;
    }
    if (key.downArrow) {
      updateSelection(Math.min(themes.length - 1, selectedIdx + 1));
      return;
    }

    if (key.return) {
      setLocalConfig((c) => ({ ...c, theme: themes[selectedIdx].name }));
      applyTheme(themes[selectedIdx]);
      onClose({ ...localConfig, theme: themes[selectedIdx].name });
      return;
    }

    if (input === 'c') {
      setNamingAction('copy');
      setNameInput(themes[selectedIdx].name + '-custom');
      setView('naming');
      return;
    }

    const selected = themes[selectedIdx];
    if (input === 'e') {
      if (selected.builtin) {
        showToast('Copy (c) a built-in theme to edit it');
        return;
      }
      setEditingTheme(selected);
      setView('editor');
      return;
    }

    if (input === 'r') {
      if (selected.builtin) {
        showToast('Copy (c) a built-in theme to rename it');
        return;
      }
      setNamingAction('rename');
      setNameInput(selected.name);
      setView('naming');
      return;
    }

    if (input === 'd') {
      if (selected.builtin) {
        showToast('Cannot delete built-in themes');
        return;
      }
      const updated = { ...localConfig.customThemes };
      delete updated[selected.name];
      const newTheme = localConfig.theme === selected.name ? 'one-dark' : localConfig.theme;
      setLocalConfig((c) => ({ ...c, theme: newTheme, customThemes: updated }));
      if (localConfig.theme === selected.name) applyTheme(getDefaultTheme());
      setSelectedIdx((i) => Math.min(i, themes.length - 2));
      showToast(`Deleted '${selected.name}'`);
      return;
    }

    if (key.backspace || key.delete) {
      setLocalConfig((c) => ({ ...c, theme: 'one-dark' }));
      applyTheme(getDefaultTheme());
      showToast('Restored default theme');
    }
  });

  const handleEditorSave = useCallback((updated: ThemeDefinition) => {
    setLocalConfig((c) => ({
      ...c,
      customThemes: {
        ...c.customThemes,
        [updated.name]: { name: updated.name, colors: updated.colors, toolColors: updated.toolColors },
      },
    }));
    applyTheme(updated);
    setView('list');
    setEditingTheme(null);
    showToast(`Saved '${updated.name}'`);
  }, []);

  const handleEditorCancel = useCallback(() => {
    const restoreTheme = resolveTheme(localConfig.theme, localConfig.customThemes);
    applyTheme(restoreTheme);
    setView('list');
    setEditingTheme(null);
  }, [localConfig]);

  if (view === 'editor' && editingTheme) {
    return (
      <Box flexDirection="column" height={termHeight}>
        <Box borderStyle="round" borderColor={colors.primary} flexDirection="column" height={termHeight}>
          <ThemeEditor theme={editingTheme} onSave={handleEditorSave} onCancel={handleEditorCancel} />
        </Box>
      </Box>
    );
  }

  const contentHeight = termHeight - 8;
  const halfView = Math.floor(contentHeight / 2);
  const scrollStart = Math.max(0, Math.min(selectedIdx - halfView, themes.length - contentHeight));
  const visibleThemes = themes.slice(Math.max(0, scrollStart), Math.max(0, scrollStart) + contentHeight);
  const visibleStartIdx = Math.max(0, scrollStart);

  return (
    <Box flexDirection="column" height={termHeight}>
      <Box
        borderStyle="round"
        borderColor={colors.primary}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        height={termHeight}
      >
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color={colors.header} bold>
            THEMES
          </Text>
          <Text color={colors.muted}>enter:apply c:copy e:edit r:rename d:delete esc:back</Text>
        </Box>

        {view === 'naming' && (
          <Box marginBottom={1}>
            <Text color={colors.warning}>{namingAction === 'copy' ? 'New name' : 'Rename to'}: </Text>
            <Text color={colors.bright}>{nameInput}_</Text>
          </Box>
        )}

        {visibleThemes.map((theme, vi) => {
          const realIdx = visibleStartIdx + vi;
          const isSelected = realIdx === selectedIdx;
          const isActive = theme.name === localConfig.theme;
          return (
            <Box key={theme.name}>
              <Text color={isSelected ? colors.primary : colors.text}>
                {isSelected ? '> ' : '  '}
                {isActive ? '* ' : '  '}
                {theme.name}
              </Text>
              <Text color={colors.muted}>{theme.builtin ? ' (built-in)' : ' (custom)'}</Text>
              <Text> </Text>
              <Text color={theme.colors.primary}>{'\u2588'}</Text>
              <Text color={theme.colors.secondary}>{'\u2588'}</Text>
              <Text color={theme.colors.accent}>{'\u2588'}</Text>
              <Text color={theme.colors.warning}>{'\u2588'}</Text>
              <Text color={theme.colors.error}>{'\u2588'}</Text>
            </Box>
          );
        })}

        {toast && (
          <Box marginTop={1} paddingX={2}>
            <Text color={colors.warning}>{toast}</Text>
          </Box>
        )}

        <Box paddingX={1} marginTop={1}>
          <Text color={colors.muted} dimColor italic wrap="truncate">
            Some themes were inspired by pop culture. Names have been changed to protect the innocent (and our legal team).
          </Text>
        </Box>
      </Box>
    </Box>
  );
});
