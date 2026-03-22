import { readdir, stat, open } from 'node:fs/promises';
import { join, basename } from 'node:path';

import { getTaskDirs, getProjectsDirs } from '../config.js';
import type { Session, ProcessInfo, TokenUsage, SessionStatus } from './types.js';
import { STATUS_PRIORITY } from './types.js';
import { loadConfig } from '../config/store.js';
import { setCachedSessions, isRefreshInFlight, setRefreshInFlight, pruneFileMetaCache } from './cache.js';
import {
  normalisePath,
  getClaudeProcessesAsync,
  extractSessionMetaCached,
  readFirstEventAsync,
  findModelAndUsageAsync,
} from './asyncHelpers.js';

export const readTailBytesAsync = async (filePath: string, bytes: number): Promise<string> => {
  let fh;
  try {
    fh = await open(filePath, 'r');
    const fstat = await stat(filePath);
    const start = Math.max(0, fstat.size - bytes);
    const readSize = Math.min(bytes, fstat.size);
    const buf = Buffer.alloc(readSize);
    await fh.read(buf, 0, readSize, start);
    return buf.toString('utf-8');
  } catch {
    return '';
  } finally {
    await fh?.close();
  }
};

const detectStatusAsync = async (filePath: string, hasPid: boolean, lastActivity: number, staleTimeout: number): Promise<SessionStatus> => {
  if (!hasPid) return 'inactive';
  const tail = await readTailBytesAsync(filePath, 4096);
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
    } catch { /* malformed */ }
  }
  if (Date.now() - lastActivity > staleTimeout * 1000) return 'stale';
  return 'active';
};

const discoverFromProjectsAsync = async (
  allUsers: boolean,
  processes: ProcessInfo[],
  sessionMap: Map<string, Session>,
  seenFiles: Set<string>,
  staleTimeout: number,
  pinnedOrder: string[],
): Promise<void> => {
  const projectsDirs = getProjectsDirs(allUsers);

  for (const projectsDir of projectsDirs) {
    let projectNames: string[];
    try {
      projectNames = await readdir(projectsDir);
    } catch {
      continue;
    }

    for (const projectName of projectNames) {
      const projectPath = join(projectsDir, projectName);
      try {
        const s = await stat(projectPath);
        if (!s.isDirectory()) continue;
      } catch {
        continue;
      }

      let files: string[];
      try {
        files = (await readdir(projectPath)).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = join(projectPath, file);
        seenFiles.add(filePath);

        let fstat;
        try {
          fstat = await stat(filePath);
          if (!fstat.isFile() || fstat.size === 0) continue;
        } catch {
          continue;
        }

        const meta = await extractSessionMetaCached(filePath);
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
          status: await detectStatusAsync(filePath, matchingProcess !== undefined, fstat.mtimeMs, staleTimeout),
          pinned: pinnedOrder.includes(meta.sessionId),
        };

        sessionMap.set(meta.sessionId, session);
      }
    }
  }
};

const discoverFromTmpAsync = async (
  allUsers: boolean,
  processes: ProcessInfo[],
  sessionMap: Map<string, Session>,
  seenFiles: Set<string>,
  staleTimeout: number,
  pinnedOrder: string[],
): Promise<void> => {
  const taskDirs = getTaskDirs(allUsers);

  for (const taskDir of taskDirs) {
    let projectDirs: string[];
    try {
      projectDirs = await readdir(taskDir);
    } catch {
      continue;
    }

    for (const projectName of projectDirs) {
      const projectPath = join(taskDir, projectName);
      try {
        const s = await stat(projectPath);
        if (!s.isDirectory()) continue;
      } catch {
        continue;
      }

      const tasksPaths: string[] = [];
      const tasksDir = join(projectPath, 'tasks');
      try {
        await readdir(tasksDir);
        tasksPaths.push(tasksDir);
      } catch {
        try {
          for (const sub of await readdir(projectPath)) {
            const subTasks = join(projectPath, sub, 'tasks');
            try {
              await readdir(subTasks);
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
          outputFiles = (await readdir(tDir)).filter((f) => f.endsWith('.output')).map((f) => join(tDir, f));
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
          seenFiles.add(outputFile);
          const agentId = basename(outputFile, '.output');
          agentIds.push(agentId);

          const firstEvent = await readFirstEventAsync(outputFile);
          if (firstEvent) {
            if (!sessionId) sessionId = String(firstEvent.sessionId || '');
            if (!slug) slug = String(firstEvent.slug || '');
            if (!cwd) cwd = String(firstEvent.cwd || '');
            if (!version) version = String(firstEvent.version || '');
            if (!gitBranch) gitBranch = String(firstEvent.gitBranch || '');
          }

          try {
            const fstat = await stat(outputFile);
            const created = fstat.birthtimeMs || fstat.ctimeMs;
            if (created < startTime) startTime = created;
            if (fstat.mtimeMs > lastActivity) lastActivity = fstat.mtimeMs;
          } catch {
            // ignore
          }

          const result = await findModelAndUsageAsync(outputFile);
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

        let latestFile = outputFiles[0];
        for (const f of outputFiles) {
          try {
            if ((await stat(f)).mtimeMs > (await stat(latestFile)).mtimeMs) latestFile = f;
          } catch { /* keep current */ }
        }

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
          status: await detectStatusAsync(latestFile, matchingProcess !== undefined, lastActivity, staleTimeout),
          pinned: pinnedOrder.includes(sessionId),
        };

        sessionMap.set(sessionId || projectName, session);
      }
    }
  }
};

const discoverSessionsAsync = async (allUsers: boolean): Promise<Session[]> => {
  const config = loadConfig();
  const staleTimeout = config.alerts.staleTimeout ?? 60;
  const pinnedOrder = config.pinnedSessions ?? [];
  const processes = await getClaudeProcessesAsync();
  const sessionMap = new Map<string, Session>();
  const seenFiles = new Set<string>();

  await discoverFromProjectsAsync(allUsers, processes, sessionMap, seenFiles, staleTimeout, pinnedOrder);
  await discoverFromTmpAsync(allUsers, processes, sessionMap, seenFiles, staleTimeout, pinnedOrder);

  pruneFileMetaCache(seenFiles);

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

export const triggerRefresh = (allUsers: boolean): void => {
  if (isRefreshInFlight()) return;
  setRefreshInFlight(true);
  discoverSessionsAsync(allUsers)
    .then((result) => setCachedSessions(result))
    .catch(() => {
      // keep stale cache on error
    })
    .finally(() => setRefreshInFlight(false));
};

export { getCachedSessions, subscribe } from './cache.js';
