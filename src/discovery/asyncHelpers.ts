import { execFile } from 'node:child_process';
import { open, stat, readlink } from 'node:fs/promises';

import type { ProcessInfo, TokenUsage } from './types.js';
import { fileMetaCache } from './cache.js';

export const normalisePath = (p: string): string => p.replace(/\/+$/, '');

export const getClaudeProcessesAsync = async (): Promise<ProcessInfo[]> => {
  const stdout = await new Promise<string>((resolve) => {
    execFile('ps', ['aux'], { encoding: 'utf-8', timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
      resolve(err || !out ? '' : out);
    });
  });

  if (!stdout) return [];

  const procs: ProcessInfo[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.includes('/claude') || line.includes('grep') || line.includes('agenttop')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parseInt(parts[1], 10);
    if (isNaN(pid)) continue;
    const command = parts.slice(10).join(' ');
    if (command.startsWith('sudo')) continue;
    procs.push({
      pid,
      cpu: parseFloat(parts[2]) || 0,
      mem: parseFloat(parts[3]) || 0,
      memKB: parseInt(parts[5], 10) || 0,
      startTime: parts[8] || '',
      command,
      cwd: '',
    });
  }

  // resolve cwd for each process concurrently
  await Promise.all(
    procs.map(async (p) => {
      try {
        p.cwd = await readlink(`/proc/${p.pid}/cwd`);
      } catch {
        // no access or process gone
      }
    }),
  );

  return procs;
};

export const readFirstLinesAsync = async (filePath: string, bytes: number): Promise<string[]> => {
  let fh;
  try {
    fh = await open(filePath, 'r');
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString('utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  } finally {
    await fh?.close();
  }
};

export const extractSessionMetaCached = async (
  filePath: string,
): Promise<{
  sessionId: string;
  cwd: string;
  version: string;
  gitBranch: string;
  model: string;
  usage: TokenUsage;
} | null> => {
  let fstat;
  try {
    fstat = await stat(filePath);
    if (!fstat.isFile() || fstat.size === 0) return null;
  } catch {
    return null;
  }

  const cached = fileMetaCache.get(filePath);
  if (cached && cached.mtimeMs === fstat.mtimeMs && cached.size === fstat.size) {
    return {
      sessionId: cached.sessionId,
      cwd: cached.cwd,
      version: cached.version,
      gitBranch: cached.gitBranch,
      model: cached.model,
      usage: cached.usage,
    };
  }

  const lines = await readFirstLinesAsync(filePath, 65536);
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

  fileMetaCache.set(filePath, {
    mtimeMs: fstat.mtimeMs,
    size: fstat.size,
    sessionId,
    cwd,
    version,
    gitBranch,
    model,
    usage,
  });

  return { sessionId, cwd, version, gitBranch, model, usage };
};

export const readFirstEventAsync = async (filePath: string): Promise<Record<string, unknown> | null> => {
  const lines = await readFirstLinesAsync(filePath, 16384);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const findModelAndUsageAsync = async (
  filePath: string,
): Promise<{ model: string; usage: TokenUsage }> => {
  let fstat;
  try {
    fstat = await stat(filePath);
  } catch {
    return { model: '', usage: { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 } };
  }
  const cached = fileMetaCache.get(filePath);
  if (cached && cached.mtimeMs === fstat.mtimeMs && cached.size === fstat.size) {
    return { model: cached.model, usage: cached.usage };
  }

  const usage: TokenUsage = { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  let model = '';
  const lines = await readFirstLinesAsync(filePath, 65536);
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
