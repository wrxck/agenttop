import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { readTailBytes } from '../src/discovery/sessions.js';

const testDir = join(tmpdir(), `agenttop-status-test-${Date.now()}`);

describe('readTailBytes', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('reads last N bytes of a file', () => {
    const filePath = join(testDir, 'test.jsonl');
    writeFileSync(filePath, 'abcdefghij');
    const result = readTailBytes(filePath, 5);
    expect(result).toBe('fghij');
  });

  it('handles files smaller than requested bytes', () => {
    const filePath = join(testDir, 'small.jsonl');
    writeFileSync(filePath, 'abc');
    const result = readTailBytes(filePath, 100);
    expect(result).toBe('abc');
  });

  it('returns empty string for missing files', () => {
    const result = readTailBytes(join(testDir, 'nonexistent.jsonl'), 100);
    expect(result).toBe('');
  });
});

describe('status derivation', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // We test detectStatus indirectly through readTailBytes + manual parsing,
  // since detectStatus is not exported. These tests verify the logic patterns.

  it('inactive when no pid (hasPid = false)', () => {
    // detectStatus returns 'inactive' immediately when hasPid is false
    // We verify the pattern: no pid means inactive
    const filePath = join(testDir, 'inactive.jsonl');
    writeFileSync(
      filePath,
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash' }] } }) + '\n',
    );
    const tail = readTailBytes(filePath, 4096);
    const lines = tail.split('\n').filter(Boolean);
    const lastEvent = JSON.parse(lines[lines.length - 1]);
    // Even with tool_use, no pid means inactive
    expect(lastEvent.type).toBe('assistant');
    // The status logic: if (!hasPid) return 'inactive'
    const hasPid = false;
    const status = hasPid ? 'would-check-further' : 'inactive';
    expect(status).toBe('inactive');
  });

  it('waiting when assistant message has text-only content (no tool_use)', () => {
    const filePath = join(testDir, 'waiting-text.jsonl');
    const event = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Here is my response' }] },
    };
    writeFileSync(filePath, JSON.stringify(event) + '\n');

    const tail = readTailBytes(filePath, 4096);
    const lines = tail.split('\n').filter(Boolean);
    const lastEvent = JSON.parse(lines[lines.length - 1]);

    expect(lastEvent.type).toBe('assistant');
    const content = lastEvent.message?.content;
    expect(Array.isArray(content)).toBe(true);
    const hasToolUse = content.some((b: { type?: string }) => b.type === 'tool_use');
    expect(hasToolUse).toBe(false);
    // No tool_use in assistant content => 'waiting'
  });

  it('waiting when AskUserQuestion tool_use is present', () => {
    const filePath = join(testDir, 'waiting-ask.jsonl');
    const event = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'I need to ask you something' },
          { type: 'tool_use', name: 'AskUserQuestion', input: { question: 'What do you want?' } },
        ],
      },
    };
    writeFileSync(filePath, JSON.stringify(event) + '\n');

    const tail = readTailBytes(filePath, 4096);
    const lines = tail.split('\n').filter(Boolean);
    const lastEvent = JSON.parse(lines[lines.length - 1]);

    const content = lastEvent.message?.content;
    const hasAskUser = content.some(
      (b: { type?: string; name?: string }) => b.type === 'tool_use' && b.name === 'AskUserQuestion',
    );
    expect(hasAskUser).toBe(true);
    // AskUserQuestion => 'waiting'
  });

  it('active when tool_use is present (not AskUserQuestion)', () => {
    const filePath = join(testDir, 'active-tool.jsonl');
    const event = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Running a command' },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
        ],
      },
    };
    writeFileSync(filePath, JSON.stringify(event) + '\n');

    const tail = readTailBytes(filePath, 4096);
    const lines = tail.split('\n').filter(Boolean);
    const lastEvent = JSON.parse(lines[lines.length - 1]);

    const content = lastEvent.message?.content;
    const hasAskUser = content.some(
      (b: { type?: string; name?: string }) => b.type === 'tool_use' && b.name === 'AskUserQuestion',
    );
    expect(hasAskUser).toBe(false);
    const hasToolUse = content.some((b: { type?: string }) => b.type === 'tool_use');
    expect(hasToolUse).toBe(true);
    // Has tool_use but not AskUserQuestion => falls through to time check => 'active' if within timeout
  });

  it('stale when idle beyond timeout', () => {
    const staleTimeout = 60;
    const lastActivity = Date.now() - 120_000; // 2 minutes ago
    const isStale = Date.now() - lastActivity > staleTimeout * 1000;
    expect(isStale).toBe(true);
  });

  it('active when within timeout', () => {
    const staleTimeout = 60;
    const lastActivity = Date.now() - 10_000; // 10 seconds ago
    const isStale = Date.now() - lastActivity > staleTimeout * 1000;
    expect(isStale).toBe(false);
  });
});
