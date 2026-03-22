import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';

import { getTaskDirs, getProjectsDirs } from '../config.js';
import type { ToolCall, SecurityEvent, TokenUsage } from '../discovery/types.js';
import { FileTailer } from './tail.js';
import { parseLines, parseAllEvents, parseUsageFromLines } from './parser.js';

export type ToolCallHandler = (calls: ToolCall[]) => void;
export type SecurityEventHandler = (events: SecurityEvent[]) => void;
export type UsageHandler = (sessionId: string, usage: TokenUsage) => void;

export class Watcher {
  private watcher: FSWatcher | null = null;
  private tailer = new FileTailer();
  private handler: ToolCallHandler;
  private securityHandler: SecurityEventHandler | null;
  private usageHandler: UsageHandler | null;
  private allUsers: boolean;
  private knownFiles = new Set<string>();

  constructor(
    handler: ToolCallHandler,
    allUsers: boolean,
    securityHandler?: SecurityEventHandler,
    usageHandler?: UsageHandler,
  ) {
    this.handler = handler;
    this.allUsers = allUsers;
    this.securityHandler = securityHandler ?? null;
    this.usageHandler = usageHandler ?? null;
  }

  start(): void {
    const taskDirs = getTaskDirs(this.allUsers);
    const projectsDirs = getProjectsDirs(this.allUsers);
    const globs = [...taskDirs.map((d) => `${d}/**/tasks/*.output`), ...projectsDirs.map((d) => `${d}/**/*.jsonl`)];

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

      if (this.usageHandler) {
        const usage = parseUsageFromLines(lines);
        if (usage.inputTokens > 0 || usage.outputTokens > 0) {
          const firstCall = calls[0];
          if (firstCall) {
            this.usageHandler(firstCall.sessionId, usage);
          }
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
