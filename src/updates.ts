import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const getPackageVersion = async (): Promise<string> => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const pkgPath = join(dirname(thisFile), '..', 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

// resolve the npm binary from the same node prefix as this process,
// so updates go to the right location even when running under sudo
const getNpmPath = (): string => {
  const nodeDir = dirname(process.execPath);
  return join(nodeDir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
};

export type InstallMethod = 'homebrew' | 'scoop' | 'npm';

// detect how agenttop was installed by checking the executable path
export const detectInstallMethod = (): InstallMethod => {
  const execPath = process.execPath;
  const thisFile = fileURLToPath(import.meta.url);

  // homebrew: executable lives under /usr/local/Cellar, /opt/homebrew, or a homebrew prefix
  if (
    thisFile.includes('/Cellar/') ||
    thisFile.includes('/homebrew/') ||
    existsSync('/usr/local/Cellar/agenttop') ||
    existsSync('/opt/homebrew/Cellar/agenttop')
  ) {
    return 'homebrew';
  }

  // scoop: executable lives under scoop directory on windows
  if (process.platform === 'win32' && (execPath.includes('\\scoop\\') || thisFile.includes('\\scoop\\'))) {
    return 'scoop';
  }

  return 'npm';
};

export interface UpdateInfo {
  current: string;
  latest: string;
  available: boolean;
}

export const checkForUpdate = (): Promise<UpdateInfo> =>
  new Promise((resolve) => {
    const npm = getNpmPath();
    getPackageVersion().then((current) => {
      execFile(npm, ['view', 'agenttop', 'version'], { encoding: 'utf-8', timeout: 5000 }, (err, stdout) => {
        if (err || !stdout) {
          resolve({ current, latest: current, available: false });
          return;
        }
        const latest = stdout.trim();
        resolve({
          current,
          latest,
          available: latest !== current && compareVersions(latest, current) > 0,
        });
      });
    });
  });

export const installUpdate = (): Promise<string> => {
  const method = detectInstallMethod();

  if (method === 'homebrew') {
    return new Promise((resolve, reject) => {
      execFile('brew', ['upgrade', 'agenttop'], { timeout: 120000 }, (err, stdout) => {
        if (err) {
          // if brew upgrade fails (e.g. already latest), try reinstall
          execFile('brew', ['reinstall', 'agenttop'], { timeout: 120000 }, (err2, stdout2) => {
            if (err2) reject(err2);
            else resolve(stdout2.trim());
          });
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  if (method === 'scoop') {
    return new Promise((resolve, reject) => {
      execFile('scoop', ['update', 'agenttop'], { timeout: 120000, shell: true }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });
  }

  // npm
  const npm = getNpmPath();
  return new Promise((resolve, reject) => {
    execFile(npm, ['install', '-g', 'agenttop@latest'], { timeout: 60000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
};

export const restartProcess = (): void => {
  const child = spawn(process.argv[0]!, process.argv.slice(1), {
    detached: true,
    stdio: 'inherit',
  });
  child.unref();
  process.exit(0);
};

export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
};
