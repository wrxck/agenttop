import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';

import { getTaskDirs, getProjectsDirs } from '../config.js';
import type { ToolCall, ToolResult, SecurityEvent, TokenUsage } from '../discovery/types.js';
import { FileTailer } from './tail.js';
import { parseLines, parseLinesWithResults, parseAllEvents, parseUsageFromLines } from './parser.js';

export type ToolCallHandler = (calls: ToolCall[]) => void;
export type ToolResultHandler = (results: ToolResult[]) => void;
export type SecurityEventHandler = (events: SecurityEvent[]) => void;
export type UsageHandler = (sessionId: string, usage: TokenUsage) => void;

export class Watcher {
  private watcher: FSWatcher | null = null;
  private tailer = new FileTailer();
  private handler: ToolCallHandler;
  private resultHandler: ToolResultHandler | null;
  private securityHandler: SecurityEventHandler | null;
  private usageHandler: UsageHandler | null;
  private allUsers: boolean;
  private knownFiles = new Set<string>();

  constructor(
    handler: ToolCallHandler,
    allUsers: boolean,
    securityHandler?: SecurityEventHandler,
    usageHandler?: UsageHandler,
    resultHandler?: ToolResultHandler,
  ) {
    this.handler = handler;
    this.allUsers = allUsers;
    this.securityHandler = securityHandler ?? null;
    this.usageHandler = usageHandler ?? null;
    this.resultHandler = resultHandler ?? null;
  }

  start(): void {
    const taskDirs = getTaskDirs(this.allUsers);
    const projectsDirs = getProjectsDirs(this.allUsers);
    const globs = [...taskDirs.map((d) => `${d}/**/tasks/*.output`), ...projectsDirs.map((d) => `${d}/**/*.jsonl`)];

    this.watcher = watch(globs, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      usePolling: false,
    });

    this.watcher.on('add', (filePath: string) => {
      if (this.knownFiles.has(filePath)) return;
      this.knownFiles.add(filePath);
      this.tailer.seekToEndAsync(filePath);
    });

    this.watcher.on('change', (filePath: string) => {
      this.handleChange(filePath);
    });
  }

  private async handleChange(filePath: string): Promise<void> {
    const lines = await this.tailer.readNewLinesAsync(filePath);
    if (lines.length === 0) return;

    const { calls, results } = parseLinesWithResults(lines);
    if (calls.length > 0) {
      this.handler(calls);
    }
    if (this.resultHandler && results.length > 0) {
      this.resultHandler(results);
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
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.tailer.resetAll();
    this.knownFiles.clear();
  }

  async readExistingAsync(filePath: string): Promise<ToolCall[]> {
    this.tailer.reset(filePath);
    const lines = await this.tailer.readNewLinesAsync(filePath);
    return parseLines(lines);
  }

  async readExistingWithResultsAsync(filePath: string): Promise<{ calls: ToolCall[]; results: ToolResult[] }> {
    this.tailer.reset(filePath);
    const lines = await this.tailer.readNewLinesAsync(filePath);
    return parseLinesWithResults(lines);
  }

  readExisting(filePath: string): ToolCall[] {
    this.tailer.reset(filePath);
    const lines = this.tailer.readNewLines(filePath);
    return parseLines(lines);
  }
}
