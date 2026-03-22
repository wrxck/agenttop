import { readdirSync, statSync, readlinkSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

import { getTaskDirs } from '../config.js';
import type { Session, ProcessInfo, TokenUsage } from './types.js';

export const getClaudeProcesses = (): ProcessInfo[] => {
  try {
    const output = execSync('ps aux', { encoding: 'utf-8', timeout: 5000 });
    const procs = output
      .split('\n')
      .filter((line) => line.includes('/claude') && !line.includes('grep') && !line.includes('agenttop'))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[1], 10);
        let cwd = '';
        try {
          cwd = readlinkSync(`/proc/${pid}/cwd`);
        } catch {
          // no access or process gone
        }
        return {
          pid,
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          memKB: parseInt(parts[5], 10) || 0,
          startTime: parts[8] || '',
          command: parts.slice(10).join(' '),
          cwd,
        };
      })
      .filter((p) => !isNaN(p.pid))
      .filter((p) => !p.command.startsWith('sudo'));
    return procs;
  } catch {
    return [];
  }
};

const readFirstEvent = (filePath: string): Record<string, unknown> | null => {
  try {
    const fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(16384);
    const bytesRead = readSync(fd, buf, 0, 16384, 0);
    closeSync(fd);
    const line = buf.subarray(0, bytesRead).toString('utf-8').split('\n')[0];
    if (!line) return null;
    return JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const findModelAndUsage = (filePath: string): { model: string; usage: TokenUsage } => {
  const usage: TokenUsage = { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  let model = '';

  try {
    const fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(65536);
    const bytesRead = readSync(fd, buf, 0, 65536, 0);
    closeSync(fd);
    const text = buf.subarray(0, bytesRead).toString('utf-8');
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line) continue;
      try {
        const evt = JSON.parse(line);
        if (evt.type === 'assistant') {
          if (!model && evt.message?.model) {
            model = String(evt.message.model);
          }
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
  } catch {
    // ignore
  }

  return { model, usage };
};

const normalisePath = (p: string): string => {
  return p.replace(/\/+$/, '');
};

export const discoverSessions = (allUsers: boolean): Session[] => {
  const taskDirs = getTaskDirs(allUsers);
  const processes = getClaudeProcesses();
  const sessionMap = new Map<string, Session>();

  for (const taskDir of taskDirs) {
    let projectDirs: string[];
    try {
      projectDirs = readdirSync(taskDir);
    } catch {
      continue;
    }

    for (const projectName of projectDirs) {
      const projectPath = join(taskDir, projectName);
      let stat;
      try {
        stat = statSync(projectPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const tasksDir = join(projectPath, 'tasks');
      let outputFiles: string[];
      try {
        outputFiles = readdirSync(tasksDir)
          .filter((f) => f.endsWith('.output'))
          .map((f) => join(tasksDir, f));
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
      const totalUsage: TokenUsage = { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 };

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
        if (!model && result.model) {
          model = result.model;
        }
        totalUsage.inputTokens += result.usage.inputTokens;
        totalUsage.cacheCreationTokens += result.usage.cacheCreationTokens;
        totalUsage.cacheReadTokens += result.usage.cacheReadTokens;
        totalUsage.outputTokens += result.usage.outputTokens;
      }

      if (!model) {
        model = 'unknown';
      }

      const normCwd = normalisePath(cwd);
      const matchingProcess = processes.find((p) => {
        if (!p.cwd) return false;
        return normalisePath(p.cwd) === normCwd;
      });

      const session: Session = {
        sessionId,
        slug: slug || sessionId.slice(0, 12),
        project: projectName.replace(/-/g, '/'),
        cwd,
        model,
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

  return Array.from(sessionMap.values()).sort((a, b) => b.lastActivity - a.lastActivity);
};
