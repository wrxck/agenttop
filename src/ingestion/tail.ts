import { statSync, openSync, readSync, closeSync } from 'node:fs';
import { stat, open } from 'node:fs/promises';

export class FileTailer {
  private offsets = new Map<string, number>();

  async readNewLinesAsync(filePath: string): Promise<string[]> {
    let currentSize: number;
    try {
      const s = await stat(filePath);
      currentSize = s.size;
    } catch {
      return [];
    }

    const lastOffset = this.offsets.get(filePath) ?? 0;
    if (currentSize <= lastOffset) return [];

    const bytesToRead = currentSize - lastOffset;
    const buf = Buffer.alloc(bytesToRead);

    let fh;
    try {
      fh = await open(filePath, 'r');
      await fh.read(buf, 0, bytesToRead, lastOffset);
    } catch {
      return [];
    } finally {
      await fh?.close();
    }

    this.offsets.set(filePath, currentSize);

    const text = buf.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return lines;
  }

  // sync variant kept for hot-path change events where chokidar
  // already knows the file changed (minimal blocking)
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

  async seekToEndAsync(filePath: string): Promise<void> {
    try {
      const s = await stat(filePath);
      this.offsets.set(filePath, s.size);
    } catch {
      // file doesn't exist yet
    }
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
