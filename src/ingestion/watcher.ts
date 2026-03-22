import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';

import { getTaskDirs } from '../config.js';
import type { ToolCall, SecurityEvent } from '../discovery/types.js';
import { FileTailer } from './tail.js';
import { parseLines, parseAllEvents } from './parser.js';

export type ToolCallHandler = (calls: ToolCall[]) => void;
export type SecurityEventHandler = (events: SecurityEvent[]) => void;

export class Watcher {
  private watcher: FSWatcher | null = null;
  private tailer = new FileTailer();
  private handler: ToolCallHandler;
  private securityHandler: SecurityEventHandler | null;
  private allUsers: boolean;
  private knownFiles = new Set<string>();

  constructor(handler: ToolCallHandler, allUsers: boolean, securityHandler?: SecurityEventHandler) {
    this.handler = handler;
    this.allUsers = allUsers;
    this.securityHandler = securityHandler ?? null;
  }

  start(): void {
    const taskDirs = getTaskDirs(this.allUsers);
    const globs = taskDirs.map((d) => `${d}/**/tasks/*.output`);

    this.watcher = watch(globs, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: false,
      usePolling: false,
    });

    this.watcher.on('add', (filePath: string) => {
      if (this.knownFiles.has(filePath)) return;
      this.knownFiles.add(filePath);
      this.tailer.seekToEnd(filePath);
    });

    this.watcher.on('change', (filePath: string) => {
      const lines = this.tailer.readNewLines(filePath);
      if (lines.length === 0) return;

      const calls = parseLines(lines);
      if (calls.length > 0) {
        this.handler(calls);
      }

      if (this.securityHandler) {
        const allEvents = parseAllEvents(lines);
        if (allEvents.length > 0) {
          this.securityHandler(allEvents);
        }
      }
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.tailer.resetAll();
    this.knownFiles.clear();
  }

  readExisting(filePath: string): ToolCall[] {
    this.tailer.reset(filePath);
    const lines = this.tailer.readNewLines(filePath);
    return parseLines(lines);
  }
}
