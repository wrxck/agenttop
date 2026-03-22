import { describe, it, expect } from 'vitest';

import { compareVersions } from '../src/updates.js';

describe('version comparison', () => {
  it('detects newer version', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
  });

  it('detects older version', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('0.9.0', '1.0.0')).toBe(-1);
  });

  it('detects equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.3.0', '0.3.0')).toBe(0);
  });

  it('handles missing segments', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1')).toBe(0);
  });
});
