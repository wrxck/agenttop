import { readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename } from 'node:path';

import { getTaskDirs, getProjectsDirs } from '../config.js';
import type { Session, ProcessInfo, TokenUsage, SessionStatus } from './types.js';
import { STATUS_PRIORITY } from './types.js';
import { loadConfig } from '../config/store.js';
import { getClaudeProcesses } from './platform.js';

export { getClaudeProcesses };

const readFirstLines = (filePath: string, bytes: number): string[] => {
  try {
    const fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(bytes);
    const bytesRead = readSync(fd, buf, 0, bytes, 0);
    closeSync(fd);
    return buf.subarray(0, bytesRead).toString('utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

export const readTailBytes = (filePath: string, bytes: number): string => {
  try {
    const fd = openSync(filePath, 'r');
    const fstat = statSync(filePath);
    const start = Math.max(0, fstat.size - bytes);
    const readSize = Math.min(bytes, fstat.size);
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, start);
    closeSync(fd);
    return buf.toString('utf-8');
  } catch {
    return '';
  }
};

const detectStatus = (filePath: string, hasPid: boolean, lastActivity: number, staleTimeout: number): SessionStatus => {
  if (!hasPid) return 'inactive';
  const tail = readTailBytes(filePath, 4096);
  const lines = tail.split('\n').filter(Boolean);
  if (lines.length > 0) {
    try {
      const lastEvent = JSON.parse(lines[lines.length - 1]);
      if (lastEvent.type === 'assistant') {
        const content = lastEvent.message?.content;
        if (Array.isArray(content)) {
          const hasAskUser = content.some(
            (b: { type?: string; name?: string }) => b.type === 'tool_use' && b.name === 'AskUserQuestion',
          );
          if (hasAskUser) return 'waiting';
          const hasToolUse = content.some((b: { type?: string }) => b.type === 'tool_use');
          if (!hasToolUse) return 'waiting';
        }
      }
    } catch {
      /* malformed */
    }
  }
  if (Date.now() - lastActivity > staleTimeout * 1000) return 'stale';
  return 'active';
};

const readFirstEvent = (filePath: string): Record<string, unknown> | null => {
  const lines = readFirstLines(filePath, 16384);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const findModelAndUsage = (filePath: string): { model: string; usage: TokenUsage } => {
  const usage: TokenUsage = { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  let model = '';

  const lines = readFirstLines(filePath, 65536);
  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'assistant') {
        if (!model && evt.message?.model) model = String(evt.message.model);
        const u = evt.message?.usage;
        if (u) {
          usage.inputTokens += u.input_tokens ?? 0;
          usage.cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
          usage.cacheReadTokens += u.cache_read_input_tokens ?? 0;
          usage.outputTokens += u.output_tokens ?? 0;
        }
      }
    } catch {
      continue;
    }
  }

  return { model, usage };
};

const normalisePath = (p: string): string => p.replace(/\/+$/, '');

const extractSessionMeta = (
  filePath: string,
): { sessionId: string; cwd: string; version: string; gitBranch: string; model: string; usage: TokenUsage } | null => {
  const lines = readFirstLines(filePath, 65536);
  let sessionId = '';
  let cwd = '';
  let version = '';
  let gitBranch = '';
  let model = '';
  const usage: TokenUsage = { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 };

  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (!sessionId && evt.sessionId) sessionId = String(evt.sessionId);
      if (!cwd && evt.cwd) cwd = String(evt.cwd);
      if (!version && evt.version) version = String(evt.version);
      if (!gitBranch && evt.gitBranch) gitBranch = String(evt.gitBranch);
      if (evt.type === 'assistant') {
        if (!model && evt.message?.model) model = String(evt.message.model);
        const u = evt.message?.usage;
        if (u) {
          usage.inputTokens += u.input_tokens ?? 0;
          usage.cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
          usage.cacheReadTokens += u.cache_read_input_tokens ?? 0;
          usage.outputTokens += u.output_tokens ?? 0;
        }
      }
    } catch {
      continue;
    }
  }

  if (!sessionId) return null;
  return { sessionId, cwd, version, gitBranch, model, usage };
};

const discoverFromProjects = (
  allUsers: boolean,
  processes: ProcessInfo[],
  sessionMap: Map<string, Session>,
  staleTimeout: number,
  pinnedOrder: string[],
): void => {
  const projectsDirs = getProjectsDirs(allUsers);

  for (const projectsDir of projectsDirs) {
    let projectNames: string[];
    try {
      projectNames = readdirSync(projectsDir);
    } catch {
      continue;
    }

    for (const projectName of projectNames) {
      const projectPath = join(projectsDir, projectName);
      try {
        if (!statSync(projectPath).isDirectory()) continue;
      } catch {
        continue;
      }

      let files: string[];
      try {
        files = readdirSync(projectPath).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = join(projectPath, file);
        let fstat;
        try {
          fstat = statSync(filePath);
          if (!fstat.isFile() || fstat.size === 0) continue;
        } catch {
          continue;
        }

        const meta = extractSessionMeta(filePath);
        if (!meta) continue;
        if (sessionMap.has(meta.sessionId)) continue;

        const normCwd = normalisePath(meta.cwd);
        const matchingProcess = processes.find((p) => p.cwd && normalisePath(p.cwd) === normCwd);

        const session: Session = {
          sessionId: meta.sessionId,
          slug: meta.sessionId.slice(0, 12),
          project: projectName.replace(/-/g, '/'),
          cwd: meta.cwd,
          model: meta.model || 'unknown',
          version: meta.version,
          gitBranch: meta.gitBranch,
          pid: matchingProcess?.pid ?? null,
          cpu: matchingProcess?.cpu ?? 0,
          mem: matchingProcess?.mem ?? 0,
          memMB: matchingProcess ? Math.round(matchingProcess.memKB / 1024) : 0,
          agentCount: 1,
          agentIds: [basename(file, '.jsonl')],
          outputFiles: [filePath],
          startTime: fstat.birthtimeMs || fstat.ctimeMs,
          lastActivity: fstat.mtimeMs,
          usage: meta.usage,
          status: detectStatus(filePath, matchingProcess !== undefined, fstat.mtimeMs, staleTimeout),
          pinned: pinnedOrder.includes(meta.sessionId),
        };

        sessionMap.set(meta.sessionId, session);
      }
    }
  }
};

const discoverFromTmp = (
  allUsers: boolean,
  processes: ProcessInfo[],
  sessionMap: Map<string, Session>,
  staleTimeout: number,
  pinnedOrder: string[],
): void => {
  const taskDirs = getTaskDirs(allUsers);

  for (const taskDir of taskDirs) {
    let projectDirs: string[];
    try {
      projectDirs = readdirSync(taskDir);
    } catch {
      continue;
    }

    for (const projectName of projectDirs) {
      const projectPath = join(taskDir, projectName);
      try {
        if (!statSync(projectPath).isDirectory()) continue;
      } catch {
        continue;
      }

      // both old (project/tasks/) and new (project/session-id/tasks/) layouts
      const tasksPaths: string[] = [];
      const tasksDir = join(projectPath, 'tasks');
      try {
        readdirSync(tasksDir);
        tasksPaths.push(tasksDir);
      } catch {
        // try nested session-id directories
        try {
          for (const sub of readdirSync(projectPath)) {
            const subTasks = join(projectPath, sub, 'tasks');
            try {
              readdirSync(subTasks);
              tasksPaths.push(subTasks);
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }

      for (const tDir of tasksPaths) {
        let outputFiles: string[];
        try {
          outputFiles = readdirSync(tDir)
            .filter((f) => f.endsWith('.output'))
            .map((f) => join(tDir, f));
        } catch {
          continue;
        }

        if (outputFiles.length === 0) continue;

        const agentIds: string[] = [];
        let sessionId = '';
        let slug = '';
        let cwd = '';
        let model = '';
        let version = '';
        let gitBranch = '';
        let startTime = Infinity;
        let lastActivity = 0;
        const totalUsage: TokenUsage = {
          inputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
        };

        for (const outputFile of outputFiles) {
          const agentId = basename(outputFile, '.output');
          agentIds.push(agentId);

          const firstEvent = readFirstEvent(outputFile);
          if (firstEvent) {
            if (!sessionId) sessionId = String(firstEvent.sessionId || '');
            if (!slug) slug = String(firstEvent.slug || '');
            if (!cwd) cwd = String(firstEvent.cwd || '');
            if (!version) version = String(firstEvent.version || '');
            if (!gitBranch) gitBranch = String(firstEvent.gitBranch || '');
          }

          try {
            const fstat = statSync(outputFile);
            const created = fstat.birthtimeMs || fstat.ctimeMs;
            if (created < startTime) startTime = created;
            if (fstat.mtimeMs > lastActivity) lastActivity = fstat.mtimeMs;
          } catch {
            // ignore
          }

          const result = findModelAndUsage(outputFile);
          if (!model && result.model) model = result.model;
          totalUsage.inputTokens += result.usage.inputTokens;
          totalUsage.cacheCreationTokens += result.usage.cacheCreationTokens;
          totalUsage.cacheReadTokens += result.usage.cacheReadTokens;
          totalUsage.outputTokens += result.usage.outputTokens;
        }

        if (!sessionId && !slug) continue;
        if (sessionMap.has(sessionId || projectName)) continue;

        const normCwd = normalisePath(cwd);
        const matchingProcess = processes.find((p) => p.cwd && normalisePath(p.cwd) === normCwd);

        const latestFile = outputFiles.reduce((a, b) => {
          try {
            return statSync(a).mtimeMs > statSync(b).mtimeMs ? a : b;
          } catch {
            return a;
          }
        });

        const session: Session = {
          sessionId,
          slug: slug || sessionId.slice(0, 12),
          project: projectName.replace(/-/g, '/'),
          cwd,
          model: model || 'unknown',
          version,
          gitBranch,
          pid: matchingProcess?.pid ?? null,
          cpu: matchingProcess?.cpu ?? 0,
          mem: matchingProcess?.mem ?? 0,
          memMB: matchingProcess ? Math.round(matchingProcess.memKB / 1024) : 0,
          agentCount: agentIds.length,
          agentIds,
          outputFiles,
          startTime: startTime === Infinity ? Date.now() : startTime,
          lastActivity,
          usage: totalUsage,
          status: detectStatus(latestFile, matchingProcess !== undefined, lastActivity, staleTimeout),
          pinned: pinnedOrder.includes(sessionId),
        };

        sessionMap.set(sessionId || projectName, session);
      }
    }
  }
};

export const discoverSessions = (allUsers: boolean): Session[] => {
  const config = loadConfig();
  const staleTimeout = config.alerts.staleTimeout ?? 60;
  const pinnedOrder = config.pinnedSessions ?? [];
  const processes = getClaudeProcesses();
  const sessionMap = new Map<string, Session>();

  discoverFromProjects(allUsers, processes, sessionMap, staleTimeout, pinnedOrder);
  discoverFromTmp(allUsers, processes, sessionMap, staleTimeout, pinnedOrder);

  return Array.from(sessionMap.values()).sort((a, b) => {
    const aPin = pinnedOrder.indexOf(a.sessionId);
    const bPin = pinnedOrder.indexOf(b.sessionId);
    const aIsPinned = aPin !== -1;
    const bIsPinned = bPin !== -1;
    if (aIsPinned && !bIsPinned) return -1;
    if (!aIsPinned && bIsPinned) return 1;
    if (aIsPinned && bIsPinned) return aPin - bPin;
    const aPri = STATUS_PRIORITY[a.status];
    const bPri = STATUS_PRIORITY[b.status];
    if (aPri !== bPri) return aPri - bPri;
    return b.lastActivity - a.lastActivity;
  });
};
