import { existsSync, realpathSync, readdirSync } from 'node:fs';
import { homedir, platform, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';

const os = platform();

const resolvePath = (p: string): string => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};

export const getUid = (): string => {
  const uid = process.getuid?.();
  if (uid !== undefined) return String(uid);
  try {
    return userInfo().username;
  } catch {
    return process.env['USERNAME'] || process.env['USER'] || '0';
  }
};

export const isRoot = (): boolean => process.getuid?.() === 0;

export const getTmpDir = (): string => {
  if (os === 'darwin') return resolvePath('/private/tmp');
  if (os === 'win32') return tmpdir();
  return resolvePath('/tmp');
};

export const getClaudeHome = (): string => join(homedir(), '.claude');

export const getHistoryPath = (): string => join(getClaudeHome(), 'history.jsonl');

export const getTaskDirs = (allUsers: boolean): string[] => {
  const tmp = getTmpDir();
  const uid = getUid();

  if (allUsers && os !== 'win32') {
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

  if (isRoot()) {
    addDir(join('/root', '.claude', 'projects'));
    const sudoUser = process.env['SUDO_USER'];
    if (sudoUser) {
      const homeBase = os === 'darwin' ? '/Users' : '/home';
      addDir(join(homeBase, sudoUser, '.claude', 'projects'));
    }
  }

  if (allUsers && os !== 'win32') {
    try {
      const homeBase = os === 'darwin' ? '/Users' : '/home';
      for (const user of readdirSync(homeBase)) {
        addDir(join(homeBase, user, '.claude', 'projects'));
      }
    } catch {
      // can't enumerate home dirs — skip
    }
    if (os !== 'darwin') addDir(join('/root', '.claude', 'projects'));
  }

  if (allUsers && os === 'win32') {
    try {
      for (const user of readdirSync('C:\\Users')) {
        addDir(join('C:\\Users', user, '.claude', 'projects'));
      }
    } catch {
      // can't enumerate user dirs — skip
    }
  }

  return dirs;
};

export const getPlatform = (): 'linux' | 'darwin' | 'win32' => {
  if (os === 'darwin') return 'darwin';
  if (os === 'win32') return 'win32';
  return 'linux';
};

export { getConfigDir } from './config/store.js';
