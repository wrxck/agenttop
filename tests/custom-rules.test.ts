import { describe, it, expect } from 'vitest';
import { createCustomRules } from '../src/analysis/rules/custom.js';
import type { ToolCall, ToolResult } from '../src/discovery/types.js';

const makeCall = (toolName: string, toolInput: Record<string, unknown>): ToolCall => ({
  sessionId: 'test-session',
  agentId: 'test-agent',
  slug: 'test-slug',
  timestamp: Date.now(),
  toolName,
  toolInput,
  cwd: '/tmp',
});

const makeResult = (content: string): ToolResult => ({
  sessionId: 'test-session',
  agentId: 'test-agent',
  slug: 'test-slug',
  timestamp: Date.now(),
  toolUseId: 'tool-1',
  content,
  isError: false,
  cwd: '/tmp',
});

describe('custom rules', () => {
  it('matches tool input with regex', () => {
    const rules = createCustomRules([
      { name: 'rm-rf', pattern: 'rm\\s+-rf', match: 'input', severity: 'high', message: 'dangerous rm', enabled: true },
    ]);
    expect(rules.length).toBe(1);
    const alert = rules[0](makeCall('Bash', { command: 'rm -rf /' }));
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('high');
  });

  it('does not match when pattern not found', () => {
    const rules = createCustomRules([
      { name: 'rm-rf', pattern: 'rm\\s+-rf', match: 'input', severity: 'high', message: 'dangerous rm', enabled: true },
    ]);
    expect(rules[0](makeCall('Bash', { command: 'ls -la' }))).toBeNull();
  });

  it('matches tool output', () => {
    const rules = createCustomRules([
      {
        name: 'secret',
        pattern: 'API_KEY',
        match: 'output',
        severity: 'critical',
        message: 'secret found',
        enabled: true,
      },
    ]);
    expect(rules[0](makeResult('found API_KEY=abc123'))).not.toBeNull();
  });

  it('does not match tool call when match is output', () => {
    const rules = createCustomRules([
      {
        name: 'secret',
        pattern: 'API_KEY',
        match: 'output',
        severity: 'critical',
        message: 'secret found',
        enabled: true,
      },
    ]);
    expect(rules[0](makeCall('Bash', { command: 'echo API_KEY' }))).toBeNull();
  });

  it('matches toolName', () => {
    const rules = createCustomRules([
      {
        name: 'no-write',
        pattern: 'Write',
        match: 'toolName',
        severity: 'warn',
        message: 'write detected',
        enabled: true,
      },
    ]);
    expect(rules[0](makeCall('Write', { file_path: '/tmp/x' }))).not.toBeNull();
  });

  it('matches all targets', () => {
    const rules = createCustomRules([
      { name: 'secret', pattern: 'secret', match: 'all', severity: 'warn', message: 'secret', enabled: true },
    ]);
    expect(rules[0](makeCall('Bash', { command: 'echo secret' }))).not.toBeNull();
    expect(rules[0](makeResult('a secret here'))).not.toBeNull();
  });

  it('skips invalid regex', () => {
    const rules = createCustomRules([
      { name: 'bad', pattern: '[invalid', match: 'all', severity: 'warn', message: 'bad', enabled: true },
    ]);
    expect(rules.length).toBe(0);
  });

  it('skips disabled rules', () => {
    const rules = createCustomRules([
      { name: 'off', pattern: 'test', match: 'all', severity: 'warn', message: 'off', enabled: false },
    ]);
    expect(rules.length).toBe(0);
  });
});
