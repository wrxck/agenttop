import { writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { FileTailer } from '../src/ingestion/tail.js';

const testDir = join(tmpdir(), `agenttop-tailer-test-${Date.now()}`);

describe('FileTailer', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('reads new lines from a file', () => {
    const file = join(testDir, 'test.jsonl');
    writeFileSync(file, 'line1\nline2\n');

    const tailer = new FileTailer();
    const lines = tailer.readNewLines(file);
    expect(lines).toEqual(['line1', 'line2']);
  });

  it('only reads new content on subsequent calls', () => {
    const file = join(testDir, 'test.jsonl');
    writeFileSync(file, 'line1\n');

    const tailer = new FileTailer();
    const first = tailer.readNewLines(file);
    expect(first).toEqual(['line1']);

    appendFileSync(file, 'line2\nline3\n');
    const second = tailer.readNewLines(file);
    expect(second).toEqual(['line2', 'line3']);
  });

  it('returns empty array for non-existent file', () => {
    const tailer = new FileTailer();
    const lines = tailer.readNewLines(join(testDir, 'nope.jsonl'));
    expect(lines).toEqual([]);
  });

  it('seekToEnd skips existing content', () => {
    const file = join(testDir, 'test.jsonl');
    writeFileSync(file, 'old1\nold2\n');

    const tailer = new FileTailer();
    tailer.seekToEnd(file);

    const lines = tailer.readNewLines(file);
    expect(lines).toEqual([]);

    appendFileSync(file, 'new1\n');
    const newLines = tailer.readNewLines(file);
    expect(newLines).toEqual(['new1']);
  });

  it('reset allows re-reading from beginning', () => {
    const file = join(testDir, 'test.jsonl');
    writeFileSync(file, 'line1\n');

    const tailer = new FileTailer();
    tailer.readNewLines(file);
    tailer.reset(file);

    const lines = tailer.readNewLines(file);
    expect(lines).toEqual(['line1']);
  });

  it('resetAll clears all tracked offsets', () => {
    const file1 = join(testDir, 'a.jsonl');
    const file2 = join(testDir, 'b.jsonl');
    writeFileSync(file1, 'a1\n');
    writeFileSync(file2, 'b1\n');

    const tailer = new FileTailer();
    tailer.readNewLines(file1);
    tailer.readNewLines(file2);
    tailer.resetAll();

    expect(tailer.readNewLines(file1)).toEqual(['a1']);
    expect(tailer.readNewLines(file2)).toEqual(['b1']);
  });

  it('async variant reads new lines', async () => {
    const file = join(testDir, 'async.jsonl');
    writeFileSync(file, 'async1\nasync2\n');

    const tailer = new FileTailer();
    const lines = await tailer.readNewLinesAsync(file);
    expect(lines).toEqual(['async1', 'async2']);
  });

  it('async seekToEnd skips existing content', async () => {
    const file = join(testDir, 'async.jsonl');
    writeFileSync(file, 'old\n');

    const tailer = new FileTailer();
    await tailer.seekToEndAsync(file);

    const lines = await tailer.readNewLinesAsync(file);
    expect(lines).toEqual([]);
  });

  it('filters empty lines', () => {
    const file = join(testDir, 'empty.jsonl');
    writeFileSync(file, 'line1\n\n\nline2\n  \n');

    const tailer = new FileTailer();
    const lines = tailer.readNewLines(file);
    expect(lines).toEqual(['line1', 'line2']);
  });
});
