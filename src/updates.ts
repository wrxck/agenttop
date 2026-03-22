import { execFile, exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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

export interface UpdateInfo {
  current: string;
  latest: string;
  available: boolean;
}

export const checkForUpdate = (): Promise<UpdateInfo> =>
  new Promise((resolve) => {
    getPackageVersion().then((current) => {
      execFile('npm', ['view', 'agenttop', 'version'], { encoding: 'utf-8', timeout: 5000 }, (err, stdout) => {
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
  return new Promise((resolve, reject) => {
    exec('npm install -g agenttop@latest', { timeout: 60000 }, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

const compareVersions = (a: string, b: string): number => {
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
