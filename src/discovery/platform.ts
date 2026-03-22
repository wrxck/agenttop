import { execFileSync, execFile } from 'node:child_process';
import { readlinkSync } from 'node:fs';
import { readlink } from 'node:fs/promises';
import { platform } from 'node:os';

import type { ProcessInfo } from './types.js';

const os = platform();

const parsePsLine = (line: string): ProcessInfo | null => {
  const parts = line.trim().split(/\s+/);
  const pid = parseInt(parts[1], 10);
  if (isNaN(pid)) return null;
  const command = parts.slice(10).join(' ');
  if (command.startsWith('sudo')) return null;
  return {
    pid,
    cpu: parseFloat(parts[2]) || 0,
    mem: parseFloat(parts[3]) || 0,
    memKB: parseInt(parts[5], 10) || 0,
    startTime: parts[8] || '',
    command,
    cwd: '',
  };
};

const isClaudeLine = (line: string): boolean =>
  (line.includes('/claude') || /\bclaude\b/.test(line)) && !line.includes('grep') && !line.includes('agenttop');

export const getProcessCwd = (pid: number): string => {
  if (os === 'linux') {
    try {
      return readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return '';
    }
  }
  if (os === 'darwin') {
    try {
      const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
        encoding: 'utf-8',
        timeout: 3000,
      });
      for (const line of out.split('\n')) {
        if (line.startsWith('n') && line.length > 1) return line.slice(1);
      }
    } catch {
      // lsof may fail for processes we don't own
    }
    return '';
  }
  // windows: cwd not reliably available from OS, resolved from session metadata
  return '';
};

export const getProcessCwdAsync = async (pid: number): Promise<string> => {
  if (os === 'linux') {
    try {
      return await readlink(`/proc/${pid}/cwd`);
    } catch {
      return '';
    }
  }
  if (os === 'darwin') {
    return new Promise((resolve) => {
      execFile(
        'lsof',
        ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
        { encoding: 'utf-8', timeout: 3000 },
        (err, out) => {
          if (err || !out) {
            resolve('');
            return;
          }
          for (const line of out.split('\n')) {
            if (line.startsWith('n') && line.length > 1) {
              resolve(line.slice(1));
              return;
            }
          }
          resolve('');
        },
      );
    });
  }
  return '';
};

const getClaudeProcessesUnix = (): ProcessInfo[] => {
  try {
    const output = execFileSync('ps', ['aux'], { encoding: 'utf-8', timeout: 5000 });
    return output
      .split('\n')
      .filter(isClaudeLine)
      .map(parsePsLine)
      .filter((p): p is ProcessInfo => p !== null);
  } catch {
    return [];
  }
};

const getClaudeProcessesWin32 = (): ProcessInfo[] => {
  try {
    const output = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-Process | Where-Object { $_.ProcessName -match 'claude' } | Select-Object Id,CPU,WorkingSet64,Path,StartTime | ConvertTo-Json -Compress",
      ],
      { encoding: 'utf-8', timeout: 5000 },
    );
    if (!output.trim()) return [];
    const raw = JSON.parse(output.trim());
    const items = Array.isArray(raw) ? raw : [raw];
    return items
      .filter((p: Record<string, unknown>) => p.Id)
      .map((p: Record<string, unknown>) => ({
        pid: Number(p.Id),
        cpu: Number(p.CPU) || 0,
        mem: 0,
        memKB: Math.round((Number(p.WorkingSet64) || 0) / 1024),
        startTime: String(p.StartTime || ''),
        command: String(p.Path || ''),
        cwd: '',
      }));
  } catch {
    return [];
  }
};

export const getClaudeProcesses = (): ProcessInfo[] => {
  const procs = os === 'win32' ? getClaudeProcessesWin32() : getClaudeProcessesUnix();
  for (const p of procs) {
    p.cwd = getProcessCwd(p.pid);
    p.memMB = Math.round(p.memKB / 1024);
  }
  return procs;
};

const getClaudeProcessesUnixAsync = async (): Promise<ProcessInfo[]> => {
  const stdout = await new Promise<string>((resolve) => {
    execFile('ps', ['aux'], { encoding: 'utf-8', timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
      resolve(err || !out ? '' : out);
    });
  });
  if (!stdout) return [];
  return stdout
    .split('\n')
    .filter(isClaudeLine)
    .map(parsePsLine)
    .filter((p): p is ProcessInfo => p !== null);
};

const getClaudeProcessesWin32Async = async (): Promise<ProcessInfo[]> => {
  const stdout = await new Promise<string>((resolve) => {
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-Process | Where-Object { $_.ProcessName -match 'claude' } | Select-Object Id,CPU,WorkingSet64,Path,StartTime | ConvertTo-Json -Compress",
      ],
      { encoding: 'utf-8', timeout: 5000 },
      (err, out) => resolve(err || !out ? '' : out),
    );
  });
  if (!stdout.trim()) return [];
  try {
    const raw = JSON.parse(stdout.trim());
    const items = Array.isArray(raw) ? raw : [raw];
    return items
      .filter((p: Record<string, unknown>) => p.Id)
      .map((p: Record<string, unknown>) => ({
        pid: Number(p.Id),
        cpu: Number(p.CPU) || 0,
        mem: 0,
        memKB: Math.round((Number(p.WorkingSet64) || 0) / 1024),
        startTime: String(p.StartTime || ''),
        command: String(p.Path || ''),
        cwd: '',
      }));
  } catch {
    return [];
  }
};

export const getClaudeProcessesAsync = async (): Promise<ProcessInfo[]> => {
  const procs = os === 'win32' ? await getClaudeProcessesWin32Async() : await getClaudeProcessesUnixAsync();
  await Promise.all(
    procs.map(async (p) => {
      p.cwd = await getProcessCwdAsync(p.pid);
      p.memMB = Math.round(p.memKB / 1024);
    }),
  );
  return procs;
};
