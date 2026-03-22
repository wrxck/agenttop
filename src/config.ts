import { existsSync, realpathSync, readdirSync } from 'node:fs';
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

  if (allUsers) {
    try {
      const dirs = readdirSync(tmp)
        .filter((d: string) => d.startsWith('claude-'))
        .filter((d: string) => !d.endsWith('-cwd'))
        .map((d: string) => join(tmp, d));
      if (dirs.length > 0) return dirs;
    } catch {
      // fall through to default
    }
  }

  return [join(tmp, `claude-${uid}`)];
};

export const getProjectsDirs = (allUsers: boolean): string[] => {
  const dirs: string[] = [];
  const home = homedir();
  const primary = join(home, '.claude', 'projects');
  if (existsSync(primary)) dirs.push(primary);

  if (allUsers) {
    try {
      const homeBase = platform() === 'darwin' ? '/Users' : '/home';
      for (const user of readdirSync(homeBase)) {
        const userProjects = join(homeBase, user, '.claude', 'projects');
        if (userProjects !== primary && existsSync(userProjects)) {
          dirs.push(userProjects);
        }
      }
    } catch {
      // can't read /home — skip
    }
    const rootProjects = join('/root', '.claude', 'projects');
    if (!dirs.includes(rootProjects) && existsSync(rootProjects)) {
      dirs.push(rootProjects);
    }
  }

  return dirs;
};

export const getPlatform = (): 'linux' | 'darwin' | 'win32' => {
  const p = platform();
  if (p === 'darwin') return 'darwin';
  if (p === 'win32') return 'win32';
  return 'linux';
};

export { getConfigDir } from './config/store.js';
