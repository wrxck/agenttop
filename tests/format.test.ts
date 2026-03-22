import { describe, it, expect } from 'vitest';

import { formatTokens, formatTime, formatModel, formatModelShort } from '../src/ui/format.js';

describe('formatTokens', () => {
  it('formats millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M');
    expect(formatTokens(1_000_000)).toBe('1.0M');
  });

  it('formats thousands', () => {
    expect(formatTokens(1_500)).toBe('1.5k');
    expect(formatTokens(1_000)).toBe('1.0k');
  });

  it('formats small numbers as-is', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(0)).toBe('0');
  });
});

describe('formatTime', () => {
  it('formats timestamp as HH:MM:SS', () => {
    const ts = new Date('2026-01-01T14:30:45Z').getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe('formatModel', () => {
  it('recognises opus', () => {
    expect(formatModel('claude-opus-4-20250514')).toBe('opus');
  });

  it('recognises sonnet', () => {
    expect(formatModel('claude-sonnet-4-20250514')).toBe('sonnet');
  });

  it('recognises haiku', () => {
    expect(formatModel('claude-haiku-4-20250514')).toBe('haiku');
  });

  it('truncates unknown models', () => {
    expect(formatModel('gpt-4o-mini')).toBe('gpt-');
  });
});

describe('formatModelShort', () => {
  it('abbreviates sonnet to son', () => {
    expect(formatModelShort('claude-sonnet-4-20250514')).toBe('son');
  });

  it('abbreviates haiku to hai', () => {
    expect(formatModelShort('claude-haiku-4-20250514')).toBe('hai');
  });
});
