import { readdirSync, readFileSync, statSync, readlinkSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

import { getTaskDirs } from '../config.js';
import type { Session, RawEvent, ProcessInfo } from './types.js';

export const getClaudeProcesses = (): ProcessInfo[] => {
  try {
    const output = execSync('ps aux', { encoding: 'utf-8', timeout: 5000 });
    return output
      .split('\n')
      .filter((line) => line.includes('claude') && !line.includes('grep') && !line.includes('agenttop'))
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[1], 10),
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          memKB: parseInt(parts[5], 10) || 0,
          startTime: parts[8] || '',
          command: parts.slice(10).join(' '),
        };
      })
      .filter((p) => !isNaN(p.pid));
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

const readLastLines = (filePath: string, count: number): RawEvent[] => {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const last = lines.slice(-count);
    return last
      .map((line) => {
        try {
          return JSON.parse(line) as RawEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is RawEvent => e !== null);
  } catch {
    return [];
  }
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

        const lastEvents = readLastLines(outputFile, 3);
        for (const evt of lastEvents) {
          if (!model && evt.type === 'assistant') {
            const content = evt.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (typeof block === 'object' && block !== null && 'model' in block) {
                  model = (block as Record<string, string>).model;
                }
              }
            }
          }
        }
      }

      if (!model) {
        model = 'unknown';
      }

      const matchingProcess = processes.find(
        (p) => p.command.includes('claude') && p.command.includes(sessionId.slice(0, 8)),
      );

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
      };

      sessionMap.set(sessionId || projectName, session);
    }
  }

  return Array.from(sessionMap.values()).sort((a, b) => b.lastActivity - a.lastActivity);
};
