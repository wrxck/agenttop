import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { loadConfig, saveConfig, isFirstRun, setNickname, clearNickname, getConfigDir } from '../src/config/store.js';

const testDir = join(tmpdir(), `agenttop-test-${Date.now()}`);

describe('config store', () => {
  beforeEach(() => {
    process.env.XDG_CONFIG_HOME = testDir;
    mkdirSync(join(testDir, 'agenttop'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.XDG_CONFIG_HOME;
  });

  it('returns defaults when no config exists', () => {
    const config = loadConfig();
    expect(config.pollInterval).toBe(10000);
    expect(config.maxEvents).toBe(200);
    expect(config.maxAlerts).toBe(100);
    expect(config.notifications.bell).toBeTruthy();
    expect(config.security.enabled).toBeTruthy();
  });

  it('detects first run correctly', () => {
    expect(isFirstRun()).toBeTruthy();
    const config = loadConfig();
    saveConfig(config);
    expect(isFirstRun()).toBeFalsy();
  });

  it('saves and loads config', () => {
    const config = loadConfig();
    config.pollInterval = 5000;
    config.nicknames['test-session'] = 'my-nick';
    saveConfig(config);

    const loaded = loadConfig();
    expect(loaded.pollInterval).toBe(5000);
    expect(loaded.nicknames['test-session']).toBe('my-nick');
  });

  it('merges new defaults into existing config', () => {
    writeFileSync(join(testDir, 'agenttop', 'config.json'), JSON.stringify({ pollInterval: 5000 }));
    const config = loadConfig();
    expect(config.pollInterval).toBe(5000);
    expect(config.maxEvents).toBe(200);
    expect(config.notifications.bell).toBeTruthy();
  });

  it('set/clear nickname', () => {
    saveConfig(loadConfig());
    setNickname('sess-1', 'my-project');
    const config = loadConfig();
    expect(config.nicknames['sess-1']).toBe('my-project');

    clearNickname('sess-1');
    const config2 = loadConfig();
    expect(config2.nicknames['sess-1']).toBeUndefined();
  });

  it('respects XDG_CONFIG_HOME', () => {
    const dir = getConfigDir();
    expect(dir).toBe(join(testDir, 'agenttop'));
  });
});
