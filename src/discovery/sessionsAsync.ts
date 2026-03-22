import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

import { getTaskDirs, getProjectsDirs } from '../config.js';
import type { Session, ProcessInfo, TokenUsage } from './types.js';
import {
  setCachedSessions,
  isRefreshInFlight,
  setRefreshInFlight,
  pruneFileMetaCache,
} from './cache.js';
import {
  normalisePath,
  getClaudeProcessesAsync,
  extractSessionMetaCached,
  readFirstEventAsync,
  findModelAndUsageAsync,
} from './asyncHelpers.js';

const discoverFromProjectsAsync = async (
  allUsers: boolean,
  processes: ProcessInfo[],
  sessionMap: Map<string, Session>,
  seenFiles: Set<string>,
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
          outputFiles = (await readdir(tDir))
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
        };

        sessionMap.set(sessionId || projectName, session);
      }
    }
  }
};

const discoverSessionsAsync = async (allUsers: boolean): Promise<Session[]> => {
  const processes = await getClaudeProcessesAsync();
  const sessionMap = new Map<string, Session>();
  const seenFiles = new Set<string>();

  await discoverFromProjectsAsync(allUsers, processes, sessionMap, seenFiles);
  await discoverFromTmpAsync(allUsers, processes, sessionMap, seenFiles);

  pruneFileMetaCache(seenFiles);

  return Array.from(sessionMap.values()).sort((a, b) => {
    const aActive = a.pid !== null ? 1 : 0;
    const bActive = b.pid !== null ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
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
