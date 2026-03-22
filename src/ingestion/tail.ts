import { openSync, readSync, closeSync, statSync } from 'node:fs';

export class FileTailer {
  private offsets = new Map<string, number>();

  readNewLines(filePath: string): string[] {
    let currentSize: number;
    try {
      currentSize = statSync(filePath).size;
    } catch {
      return [];
    }

    const lastOffset = this.offsets.get(filePath) ?? 0;
    if (currentSize <= lastOffset) return [];

    const bytesToRead = currentSize - lastOffset;
    const buf = Buffer.alloc(bytesToRead);

    let fd: number;
    try {
      fd = openSync(filePath, 'r');
    } catch {
      return [];
    }

    try {
      readSync(fd, buf, 0, bytesToRead, lastOffset);
    } finally {
      closeSync(fd);
    }

    this.offsets.set(filePath, currentSize);

    const text = buf.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return lines;
  }

  seekToEnd(filePath: string): void {
    try {
      const size = statSync(filePath).size;
      this.offsets.set(filePath, size);
    } catch {
      // file doesn't exist yet
    }
  }

  reset(filePath: string): void {
    this.offsets.delete(filePath);
  }

  resetAll(): void {
    this.offsets.clear();
  }
}
