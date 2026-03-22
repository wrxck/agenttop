import { describe, it, expect } from 'vitest';

import {
  parseLine,
  extractToolCalls,
  extractToolResults,
  extractUsage,
  parseLines,
  parseUsageFromLines,
} from '../src/ingestion/parser.js';
import type { RawEvent } from '../src/discovery/types.js';

const makeAssistantEvent = (content: unknown[], usage?: Record<string, number>): RawEvent => ({
  type: 'assistant',
  sessionId: 'sess-1',
  agentId: 'agent-1',
  slug: 'test-slug',
  timestamp: '2026-01-01T12:00:00Z',
  cwd: '/home/test',
  version: '2.0.0',
  gitBranch: 'main',
  message: {
    role: 'assistant',
    content,
    model: 'claude-sonnet-4-5-20250929',
    usage,
  },
});

const makeUserEvent = (content: unknown[]): RawEvent => ({
  type: 'user',
  sessionId: 'sess-1',
  agentId: 'agent-1',
  slug: 'test-slug',
  timestamp: '2026-01-01T12:00:01Z',
  cwd: '/home/test',
  version: '2.0.0',
  gitBranch: 'main',
  message: { role: 'user', content },
});

describe('parseLine', () => {
  it('parses valid JSON', () => {
    const result = parseLine('{"type":"assistant","sessionId":"x"}');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
  });

  it('returns null for invalid JSON', () => {
    expect(parseLine('not json')).toBeNull();
    expect(parseLine('')).toBeNull();
  });
});

describe('extractToolCalls', () => {
  it('extracts tool_use blocks from assistant events', () => {
    const event = makeAssistantEvent([
      { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
      { type: 'tool_use', name: 'Read', input: { file_path: '/tmp/test' } },
    ]);
    const calls = extractToolCalls(event);
    expect(calls).toHaveLength(2);
    expect(calls[0].toolName).toBe('Bash');
    expect(calls[0].toolInput.command).toBe('ls');
    expect(calls[1].toolName).toBe('Read');
  });

  it('uses event timestamp instead of Date.now()', () => {
    const event = makeAssistantEvent([{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }]);
    const calls = extractToolCalls(event);
    expect(calls[0].timestamp).toBe(new Date('2026-01-01T12:00:00Z').getTime());
  });

  it('returns empty for non-assistant events', () => {
    const event = makeUserEvent([]);
    expect(extractToolCalls(event)).toHaveLength(0);
  });

  it('returns empty when content is not an array', () => {
    const event = makeAssistantEvent([]);
    event.message.content = 'text only';
    expect(extractToolCalls(event)).toHaveLength(0);
  });
});

describe('extractToolResults', () => {
  it('extracts tool_result blocks from user events', () => {
    const event = makeUserEvent([
      { type: 'tool_result', tool_use_id: 'tool-1', content: 'output text', is_error: false },
    ]);
    const results = extractToolResults(event);
    expect(results).toHaveLength(1);
    expect(results[0].toolUseId).toBe('tool-1');
    expect(results[0].content).toBe('output text');
    expect(results[0].isError).toBe(false);
  });

  it('handles array content in tool results', () => {
    const event = makeUserEvent([
      { type: 'tool_result', tool_use_id: 'tool-2', content: [{ text: 'line1' }, { text: 'line2' }] },
    ]);
    const results = extractToolResults(event);
    expect(results[0].content).toBe('line1\nline2');
  });

  it('returns empty for assistant events', () => {
    const event = makeAssistantEvent([]);
    expect(extractToolResults(event)).toHaveLength(0);
  });
});

describe('extractUsage', () => {
  it('extracts token usage from assistant events', () => {
    const event = makeAssistantEvent([], {
      input_tokens: 100,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 300,
      output_tokens: 50,
    });
    const usage = extractUsage(event);
    expect(usage).toEqual({
      inputTokens: 100,
      cacheCreationTokens: 200,
      cacheReadTokens: 300,
      outputTokens: 50,
    });
  });

  it('returns null for user events', () => {
    const event = makeUserEvent([]);
    expect(extractUsage(event)).toBeNull();
  });

  it('returns null when no usage field', () => {
    const event = makeAssistantEvent([]);
    expect(extractUsage(event)).toBeNull();
  });

  it('defaults missing usage fields to 0', () => {
    const event = makeAssistantEvent([], { input_tokens: 5 });
    const usage = extractUsage(event);
    expect(usage?.outputTokens).toBe(0);
    expect(usage?.cacheReadTokens).toBe(0);
  });
});

describe('parseLines', () => {
  it('parses multiple JSONL lines into tool calls', () => {
    const lines = [
      JSON.stringify(makeAssistantEvent([{ type: 'tool_use', name: 'Bash', input: { command: 'echo hi' } }])),
      JSON.stringify(makeAssistantEvent([{ type: 'tool_use', name: 'Read', input: { file_path: '/tmp/x' } }])),
    ];
    const calls = parseLines(lines);
    expect(calls).toHaveLength(2);
  });

  it('skips invalid lines', () => {
    const calls = parseLines(['invalid', '{}']);
    expect(calls).toHaveLength(0);
  });
});

describe('parseUsageFromLines', () => {
  it('accumulates usage across multiple events', () => {
    const lines = [
      JSON.stringify(makeAssistantEvent([], { input_tokens: 10, output_tokens: 5 })),
      JSON.stringify(makeAssistantEvent([], { input_tokens: 20, output_tokens: 15 })),
    ];
    const usage = parseUsageFromLines(lines);
    expect(usage.inputTokens).toBe(30);
    expect(usage.outputTokens).toBe(20);
  });
});
