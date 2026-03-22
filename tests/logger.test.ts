import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AlertLogger } from '../src/alerts/logger.js';
import type { Config } from '../src/config/store.js';
import type { Alert, ToolCall } from '../src/discovery/types.js';

const testDir = join(tmpdir(), `agenttop-logger-test-${Date.now()}`);
const logPath = join(testDir, 'alerts.jsonl');

const makeConfig = (): Config => ({
  pollInterval: 10000,
  maxEvents: 200,
  maxAlerts: 100,
  alertLevel: 'warn',
  notifications: { bell: false, desktop: false, minSeverity: 'high' },
  alerts: { logFile: logPath, enabled: true },
  updates: { checkOnLaunch: false, checkInterval: 21600000 },
  nicknames: {},
  security: {
    enabled: true,
    rules: { network: true, exfiltration: true, sensitiveFiles: true, shellEscape: true, injection: true },
  },
  prompts: { hook: 'dismissed', mcp: 'dismissed' },
});

const makeAlert = (message: string): Alert => ({
  id: `test-${Date.now()}`,
  severity: 'warn',
  rule: 'test',
  message,
  sessionSlug: 'test-slug',
  sessionId: 'sess-1',
  event: {
    sessionId: 'sess-1',
    agentId: 'agent-1',
    slug: 'test-slug',
    timestamp: Date.now(),
    toolName: 'Bash',
    toolInput: { command: 'test' },
    cwd: '/tmp',
  } as ToolCall,
  timestamp: Date.now(),
});

describe('AlertLogger', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('writes alerts to JSONL file', () => {
    const logger = new AlertLogger(makeConfig());
    logger.log(makeAlert('test alert 1'));
    logger.log(makeAlert('test alert 2'));

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.message).toBe('test alert 1');
    expect(parsed.severity).toBe('warn');
    expect(parsed.rule).toBe('test');
  });
});
