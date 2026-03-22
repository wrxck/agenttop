import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import type { Config, KeybindingsConfig, SecurityRulesConfig, NotificationsConfig } from '../../config/store.js';
import { colors } from '../theme.js';

interface SettingsMenuProps {
  config: Config;
  onClose: (updatedConfig: Config) => void;
}

type ItemType = 'keybind' | 'toggle' | 'cycle' | 'header';

interface MenuItem {
  type: ItemType;
  label: string;
  section: string;
  key?: string;
  getValue: (config: Config) => string;
  apply?: (config: Config, newValue?: string) => Config;
}

const KEYBIND_LABELS: Record<keyof KeybindingsConfig, string> = {
  quit: 'Quit',
  navUp: 'Navigate up',
  navDown: 'Navigate down',
  panelNext: 'Next panel',
  panelPrev: 'Previous panel',
  scrollTop: 'Scroll to top',
  scrollBottom: 'Scroll to bottom',
  filter: 'Filter sessions',
  nickname: 'Set nickname',
  clearNickname: 'Clear nickname',
  detail: 'Detail view',
  update: 'Install update',
  settings: 'Settings',
};

const RULE_LABELS: Record<keyof SecurityRulesConfig, string> = {
  network: 'Network detection',
  exfiltration: 'Exfiltration detection',
  sensitiveFiles: 'Sensitive files',
  shellEscape: 'Shell escape',
  injection: 'Prompt injection',
};

const SEVERITY_OPTIONS: NotificationsConfig['minSeverity'][] = ['info', 'warn', 'high', 'critical'];

const displayKey = (key: string): string => {
  if (key === 'tab') return 'tab';
  if (key === 'shift+tab') return 'S-tab';
  if (key === 'enter') return 'enter';
  return key;
};

const buildMenuItems = (): MenuItem[] => {
  const items: MenuItem[] = [];

  items.push({ type: 'header', label: 'KEYBINDINGS', section: 'keybindings', getValue: () => '', key: undefined });

  for (const [k, label] of Object.entries(KEYBIND_LABELS)) {
    const kbKey = k as keyof KeybindingsConfig;
    items.push({
      type: 'keybind',
      label,
      section: 'keybindings',
      key: kbKey,
      getValue: (cfg) => displayKey(cfg.keybindings[kbKey]),
      apply: (cfg, newValue) => ({
        ...cfg,
        keybindings: { ...cfg.keybindings, [kbKey]: newValue },
      }),
    });
  }

  items.push({ type: 'header', label: 'SECURITY RULES', section: 'security', getValue: () => '', key: undefined });

  for (const [k, label] of Object.entries(RULE_LABELS)) {
    const ruleKey = k as keyof SecurityRulesConfig;
    items.push({
      type: 'toggle',
      label,
      section: 'security',
      key: ruleKey,
      getValue: (cfg) => (cfg.security.rules[ruleKey] ? 'ON' : 'OFF'),
      apply: (cfg) => ({
        ...cfg,
        security: {
          ...cfg.security,
          rules: { ...cfg.security.rules, [ruleKey]: !cfg.security.rules[ruleKey] },
        },
      }),
    });
  }

  items.push({
    type: 'header',
    label: 'NOTIFICATIONS',
    section: 'notifications',
    getValue: () => '',
    key: undefined,
  });

  items.push({
    type: 'toggle',
    label: 'Terminal bell',
    section: 'notifications',
    key: 'bell',
    getValue: (cfg) => (cfg.notifications.bell ? 'ON' : 'OFF'),
    apply: (cfg) => ({
      ...cfg,
      notifications: { ...cfg.notifications, bell: !cfg.notifications.bell },
    }),
  });

  items.push({
    type: 'toggle',
    label: 'Desktop notifications',
    section: 'notifications',
    key: 'desktop',
    getValue: (cfg) => (cfg.notifications.desktop ? 'ON' : 'OFF'),
    apply: (cfg) => ({
      ...cfg,
      notifications: { ...cfg.notifications, desktop: !cfg.notifications.desktop },
    }),
  });

  items.push({
    type: 'cycle',
    label: 'Minimum severity',
    section: 'notifications',
    key: 'minSeverity',
    getValue: (cfg) => cfg.notifications.minSeverity,
    apply: (cfg) => {
      const idx = SEVERITY_OPTIONS.indexOf(cfg.notifications.minSeverity);
      const next = SEVERITY_OPTIONS[(idx + 1) % SEVERITY_OPTIONS.length];
      return { ...cfg, notifications: { ...cfg.notifications, minSeverity: next } };
    },
  });

  return items;
};

const MENU_ITEMS = buildMenuItems();
const SELECTABLE_INDICES = MENU_ITEMS.map((item, i) => (item.type !== 'header' ? i : -1)).filter((i) => i >= 0);

export const SettingsMenu: React.FC<SettingsMenuProps> = React.memo(({ config, onClose }) => {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const [localConfig, setLocalConfig] = useState<Config>(() => JSON.parse(JSON.stringify(config)));
  const [selectablePos, setSelectablePos] = useState(0);
  const [rebinding, setRebinding] = useState(false);

  const selectedIndex = SELECTABLE_INDICES[selectablePos];
  const maxLabelLen = useMemo(
    () => Math.max(...MENU_ITEMS.filter((i) => i.type !== 'header').map((i) => i.label.length)),
    [],
  );

  useInput((input, key) => {
    if (rebinding) {
      const item = MENU_ITEMS[selectedIndex];
      let newKey: string;
      if (key.tab && key.shift) newKey = 'shift+tab';
      else if (key.tab) newKey = 'tab';
      else if (key.return) newKey = 'enter';
      else if (key.escape) {
        setRebinding(false);
        return;
      } else if (input && input.length === 1) newKey = input;
      else return;

      if (item.apply) {
        setLocalConfig((c) => item.apply!(c, newKey));
      }
      setRebinding(false);
      return;
    }

    if (key.escape) {
      onClose(localConfig);
      return;
    }

    if (key.upArrow) {
      setSelectablePos((p) => Math.max(0, p - 1));
      return;
    }
    if (key.downArrow) {
      setSelectablePos((p) => Math.min(SELECTABLE_INDICES.length - 1, p + 1));
      return;
    }

    if (key.return) {
      const item = MENU_ITEMS[selectedIndex];
      if (item.type === 'keybind') {
        setRebinding(true);
      } else if (item.apply) {
        setLocalConfig((c) => item.apply!(c));
      }
    }
  });

  const contentHeight = termHeight - 6;
  const halfView = Math.floor(contentHeight / 2);
  const menuItemIndex = MENU_ITEMS.indexOf(MENU_ITEMS[selectedIndex]);
  const scrollStart = Math.max(0, Math.min(menuItemIndex - halfView, MENU_ITEMS.length - contentHeight));
  const visibleItems = MENU_ITEMS.slice(Math.max(0, scrollStart), Math.max(0, scrollStart) + contentHeight);
  const visibleStartIndex = Math.max(0, scrollStart);

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
            SETTINGS
          </Text>
          <Text color={colors.muted}>esc to save &amp; close</Text>
        </Box>

        {visibleItems.map((item, vi) => {
          const realIndex = visibleStartIndex + vi;
          const isSelected = realIndex === selectedIndex;

          if (item.type === 'header') {
            return (
              <Box key={`h-${item.label}`} marginTop={realIndex > 0 ? 1 : 0}>
                <Text color={colors.accent} bold>
                  {'  '}
                  {item.label}
                </Text>
              </Box>
            );
          }

          const value = item.getValue(localConfig);
          const dots = '.'.repeat(Math.max(2, maxLabelLen - item.label.length + 4));
          const isRebindingThis = rebinding && isSelected;
          const displayValue = isRebindingThis ? '[press key...]' : value;
          const valueColor = isRebindingThis
            ? colors.warning
            : value === 'ON'
              ? colors.secondary
              : value === 'OFF'
                ? colors.error
                : colors.bright;

          return (
            <Box key={`${item.section}-${item.key}`}>
              <Text color={isSelected ? colors.primary : colors.text}>
                {isSelected ? '> ' : '  '}
                {'  '}
                {item.label} {dots}{' '}
              </Text>
              <Text color={valueColor}>{displayValue}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});
