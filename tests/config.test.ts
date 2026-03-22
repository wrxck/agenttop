import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  loadConfig,
  saveConfig,
  isFirstRun,
  setNickname,
  clearNickname,
  getConfigDir,
  archiveSession,
  unarchiveSession,
  getArchived,
  purgeExpiredArchives,
  deleteSessionFiles,
} from '../src/config/store.js';

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

  it('archive and unarchive session', () => {
    saveConfig(loadConfig());
    archiveSession('sess-a');
    const archived = getArchived();
    expect(archived['sess-a']).toBeDefined();
    expect(typeof archived['sess-a']).toBe('number');

    unarchiveSession('sess-a');
    const archived2 = getArchived();
    expect(archived2['sess-a']).toBeUndefined();
  });

  it('purges expired archives', () => {
    const config = loadConfig();
    config.archiveExpiryDays = 7;
    config.archived = {
      'old-sess': Date.now() - 8 * 86_400_000,
      'new-sess': Date.now() - 1 * 86_400_000,
    };
    saveConfig(config);

    purgeExpiredArchives();

    const loaded = loadConfig();
    expect(loaded.archived['old-sess']).toBeUndefined();
    expect(loaded.archived['new-sess']).toBeDefined();
  });

  it('does not purge when expiry is 0 (never)', () => {
    const config = loadConfig();
    config.archiveExpiryDays = 0;
    config.archived = { 'old-sess': Date.now() - 365 * 86_400_000 };
    saveConfig(config);

    purgeExpiredArchives();

    const loaded = loadConfig();
    expect(loaded.archived['old-sess']).toBeDefined();
  });

  it('deleteSessionFiles removes files', () => {
    const tmpFile = join(testDir, 'test-output.jsonl');
    writeFileSync(tmpFile, 'test data');
    deleteSessionFiles([tmpFile]);
    expect(require('node:fs').existsSync(tmpFile)).toBe(false);
  });

  it('deleteSessionFiles handles missing files gracefully', () => {
    expect(() => deleteSessionFiles(['/nonexistent/path/file.jsonl'])).not.toThrow();
  });

  it('defaults include archive fields', () => {
    const config = loadConfig();
    expect(config.archived).toEqual({});
    expect(config.archiveExpiryDays).toBe(0);
    expect(config.keybindings.archive).toBe('a');
    expect(config.keybindings.delete).toBe('d');
    expect(config.keybindings.viewArchive).toBe('A');
  });
});
