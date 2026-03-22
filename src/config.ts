import { realpathSync, readdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const resolvePath = (p: string): string => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};

export const getUid = (): number => process.getuid?.() ?? 0;

export const isRoot = (): boolean => getUid() === 0;

export const getTmpDir = (): string => resolvePath(platform() === 'darwin' ? '/private/tmp' : '/tmp');

export const getClaudeHome = (): string => join(homedir(), '.claude');

export const getHistoryPath = (): string => join(getClaudeHome(), 'history.jsonl');

export const getTaskDirs = (allUsers: boolean): string[] => {
  const tmp = getTmpDir();
  const uid = getUid();

  if (allUsers && isRoot()) {
    try {
      return readdirSync(tmp)
        .filter((d: string) => d.startsWith('claude-'))
        .filter((d: string) => !d.endsWith('-cwd'))
        .map((d: string) => join(tmp, d));
    } catch {
      return [join(tmp, `claude-${uid}`)];
    }
  }

  return [join(tmp, `claude-${uid}`)];
};

export const getPlatform = (): 'linux' | 'darwin' | 'win32' => {
  const p = platform();
  if (p === 'darwin') return 'darwin';
  if (p === 'win32') return 'win32';
  return 'linux';
};
