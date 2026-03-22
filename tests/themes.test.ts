import { describe, it, expect } from 'vitest';

import {
  BUILTIN_THEMES,
  getDefaultTheme,
  resolveTheme,
  getAllThemes,
  deriveSeverityColors,
  deriveToolColors,
} from '../src/config/themes.js';

describe('themes', () => {
  it('has built-in themes', () => {
    expect(BUILTIN_THEMES.length).toBeGreaterThan(0);
    for (const theme of BUILTIN_THEMES) {
      expect(theme.name).toBeTruthy();
      expect(theme.colors.primary).toBeTruthy();
      expect(theme.toolColors.Bash).toBeTruthy();
      expect(theme.builtin).toBeTruthy();
    }
  });

  it('default theme is one-dark', () => {
    const def = getDefaultTheme();
    expect(def.name).toBe('one-dark');
  });

  it('resolveTheme returns matching built-in', () => {
    const theme = resolveTheme('dracula', {});
    expect(theme.name).toBe('dracula');
  });

  it('resolveTheme returns custom theme', () => {
    const custom = {
      'my-theme': {
        name: 'my-theme',
        colors: getDefaultTheme().colors,
        toolColors: getDefaultTheme().toolColors,
      },
    };
    const theme = resolveTheme('my-theme', custom);
    expect(theme.name).toBe('my-theme');
    expect(theme.builtin).toBeFalsy();
  });

  it('resolveTheme falls back to default for unknown name', () => {
    const theme = resolveTheme('nonexistent', {});
    expect(theme.name).toBe('one-dark');
  });

  it('getAllThemes includes built-in and custom', () => {
    const custom = {
      'my-theme': {
        name: 'my-theme',
        colors: getDefaultTheme().colors,
        toolColors: getDefaultTheme().toolColors,
      },
    };
    const all = getAllThemes(custom);
    expect(all.length).toBe(BUILTIN_THEMES.length + 1);
    expect(all.some((t) => t.name === 'my-theme')).toBe(true);
  });

  it('deriveSeverityColors maps correctly', () => {
    const colors = getDefaultTheme().colors;
    const sev = deriveSeverityColors(colors);
    expect(sev.info).toBe(colors.muted);
    expect(sev.warn).toBe(colors.warning);
    expect(sev.high).toBe(colors.error);
    expect(sev.critical).toBe(colors.critical);
  });

  it('deriveToolColors maps from theme colours', () => {
    const colors = getDefaultTheme().colors;
    const tc = deriveToolColors(colors);
    expect(tc.Bash).toBe(colors.error);
    expect(tc.Read).toBe(colors.secondary);
    expect(tc.Grep).toBe(colors.primary);
  });
});
