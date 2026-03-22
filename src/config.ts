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

  const dirs = [join(tmp, `claude-${uid}`)];

  // when running as root via sudo, also include the original user's task dir
  if (isRoot()) {
    try {
      const sudoUid = process.env['SUDO_UID'];
      if (sudoUid && sudoUid !== String(uid)) {
        dirs.push(join(tmp, `claude-${sudoUid}`));
      }
    } catch {
      // ignore
    }
  }

  return dirs;
};

export const getProjectsDirs = (allUsers: boolean): string[] => {
  const dirs: string[] = [];
  const addDir = (d: string) => {
    if (!dirs.includes(d) && existsSync(d)) dirs.push(d);
  };

  const home = homedir();
  addDir(join(home, '.claude', 'projects'));

  // when running as root (e.g. sudo agenttop), always include /root and the
  // original user's home so both root-owned and user-owned sessions appear
  if (isRoot()) {
    addDir(join('/root', '.claude', 'projects'));
    const sudoUser = process.env['SUDO_USER'];
    if (sudoUser) {
      const homeBase = platform() === 'darwin' ? '/Users' : '/home';
      addDir(join(homeBase, sudoUser, '.claude', 'projects'));
    }
  }

  if (allUsers) {
    try {
      const homeBase = platform() === 'darwin' ? '/Users' : '/home';
      for (const user of readdirSync(homeBase)) {
        addDir(join(homeBase, user, '.claude', 'projects'));
      }
    } catch {
      // can't read /home — skip
    }
    addDir(join('/root', '.claude', 'projects'));
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
