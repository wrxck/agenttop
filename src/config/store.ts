import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { ThemeColors, ToolColors } from './themes.js';

export interface SecurityRulesConfig {
  network: boolean;
  exfiltration: boolean;
  sensitiveFiles: boolean;
  shellEscape: boolean;
  injection: boolean;
}

export interface NotificationsConfig {
  bell: boolean;
  desktop: boolean;
  minSeverity: 'info' | 'warn' | 'high' | 'critical';
}

export interface AlertsConfig {
  logFile: string;
  enabled: boolean;
}

export interface UpdatesConfig {
  checkOnLaunch: boolean;
  checkInterval: number;
}

export interface PromptsConfig {
  hook: 'pending' | 'installed' | 'dismissed';
  mcp: 'pending' | 'installed' | 'dismissed';
}

export interface KeybindingsConfig {
  quit: string;
  navUp: string;
  navDown: string;
  panelNext: string;
  panelPrev: string;
  scrollTop: string;
  scrollBottom: string;
  filter: string;
  nickname: string;
  clearNickname: string;
  detail: string;
  update: string;
  settings: string;
  archive: string;
  delete: string;
  viewArchive: string;
  split: string;
  pinLeft: string;
  pinRight: string;
  swapPanels: string;
  closePanel: string;
}

export interface Config {
  pollInterval: number;
  maxEvents: number;
  maxAlerts: number;
  alertLevel: 'info' | 'warn' | 'high' | 'critical';
  notifications: NotificationsConfig;
  alerts: AlertsConfig;
  updates: UpdatesConfig;
  nicknames: Record<string, string>;
  keybindings: KeybindingsConfig;
  security: {
    enabled: boolean;
    rules: SecurityRulesConfig;
  };
  prompts: PromptsConfig;
  archived: Record<string, number>;
  archiveExpiryDays: number;
  theme: string;
  customThemes: Record<string, { name: string; colors: ThemeColors; toolColors: ToolColors }>;
}

export const getConfigDir = (): string => {
  const xdg = process.env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, 'agenttop') : join(homedir(), '.config', 'agenttop');
};

export const getConfigPath = (): string => join(getConfigDir(), 'config.json');

const defaultConfig = (): Config => ({
  pollInterval: 10000,
  maxEvents: 200,
  maxAlerts: 100,
  alertLevel: 'warn',
  notifications: {
    bell: true,
    desktop: false,
    minSeverity: 'high',
  },
  alerts: {
    logFile: join(getConfigDir(), 'alerts.jsonl'),
    enabled: true,
  },
  updates: {
    checkOnLaunch: true,
    checkInterval: 21600000,
  },
  nicknames: {},
  keybindings: {
    quit: 'q',
    navUp: 'k',
    navDown: 'j',
    panelNext: 'tab',
    panelPrev: 'shift+tab',
    scrollTop: 'g',
    scrollBottom: 'G',
    filter: '/',
    nickname: 'n',
    clearNickname: 'N',
    detail: 'enter',
    update: 'u',
    settings: 's',
    archive: 'a',
    delete: 'd',
    viewArchive: 'A',
    split: 'x',
    pinLeft: '1',
    pinRight: '2',
    swapPanels: 'S',
    closePanel: 'X',
  },
  security: {
    enabled: true,
    rules: {
      network: true,
      exfiltration: true,
      sensitiveFiles: true,
      shellEscape: true,
      injection: true,
    },
  },
  prompts: {
    hook: 'pending',
    mcp: 'pending',
  },
  archived: {},
  archiveExpiryDays: 0,
  theme: 'one-dark',
  customThemes: {},
});

const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...target };
  for (const key of Object.keys(target)) {
    if (key in source) {
      const tVal = target[key];
      const sVal = source[key];
      if (tVal && sVal && typeof tVal === 'object' && typeof sVal === 'object' && !Array.isArray(tVal)) {
        result[key] = deepMerge(tVal as Record<string, unknown>, sVal as Record<string, unknown>);
      } else {
        result[key] = sVal;
      }
    }
  }
  for (const key of Object.keys(source)) {
    if (!(key in target)) {
      result[key] = source[key];
    }
  }
  return result;
};

export const loadConfig = (): Config => {
  const configPath = getConfigPath();
  const defaults = defaultConfig();

  if (!existsSync(configPath)) {
    return defaults;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return deepMerge(defaults as unknown as Record<string, unknown>, raw) as unknown as Config;
  } catch {
    return defaults;
  }
};

export const saveConfig = (config: Config): void => {
  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + '\n');
};

export const isFirstRun = (): boolean => !existsSync(getConfigPath());

export const setNickname = (sessionId: string, nickname: string): void => {
  const config = loadConfig();
  config.nicknames[sessionId] = nickname;
  saveConfig(config);
};

export const clearNickname = (sessionId: string): void => {
  const config = loadConfig();
  delete config.nicknames[sessionId];
  saveConfig(config);
};

export const getNicknames = (): Record<string, string> => {
  return loadConfig().nicknames;
};

export const resolveAlertLogPath = (config: Config): string => {
  const logFile = config.alerts.logFile;
  if (logFile.startsWith('~')) {
    return join(homedir(), logFile.slice(1));
  }
  return logFile;
};

export const rotateLogFile = (filePath: string, maxBytes = 10 * 1024 * 1024): void => {
  try {
    const stat = statSync(filePath);
    if (stat.size > maxBytes) {
      const rotated = filePath + '.1';
      if (existsSync(rotated)) {
        try {
          renameSync(rotated, filePath + '.2');
        } catch {
          /* ignore */
        }
      }
      renameSync(filePath, rotated);
    }
  } catch {
    // file doesn't exist yet
  }
};

export const archiveSession = (sessionId: string): void => {
  const config = loadConfig();
  config.archived[sessionId] = Date.now();
  saveConfig(config);
};

export const unarchiveSession = (sessionId: string): void => {
  const config = loadConfig();
  delete config.archived[sessionId];
  saveConfig(config);
};

export const getArchived = (): Record<string, number> => {
  return loadConfig().archived;
};

export const purgeExpiredArchives = (): void => {
  const config = loadConfig();
  if (config.archiveExpiryDays <= 0) return;
  const cutoff = Date.now() - config.archiveExpiryDays * 86_400_000;
  let changed = false;
  for (const [id, ts] of Object.entries(config.archived)) {
    if (ts < cutoff) {
      delete config.archived[id];
      changed = true;
    }
  }
  if (changed) saveConfig(config);
};

export const deleteSessionFiles = (outputFiles: string[]): void => {
  for (const file of outputFiles) {
    try {
      unlinkSync(file);
    } catch {
      /* file may already be gone */
    }
  }
};
