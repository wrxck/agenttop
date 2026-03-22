import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

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
