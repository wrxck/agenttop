import { execFile } from 'node:child_process';
import { platform } from 'node:os';

import type { Alert, AlertSeverity } from './discovery/types.js';
import type { NotificationsConfig } from './config/store.js';

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  info: 0,
  warn: 1,
  high: 2,
  critical: 3,
};

const RATE_LIMIT_MS = 30_000;
let lastDesktopNotification = 0;

export const notify = (alert: Alert, config: NotificationsConfig): void => {
  if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[config.minSeverity]) return;

  if (config.bell) {
    process.stdout.write('\x07');
  }

  if (config.desktop) {
    const now = Date.now();
    if (now - lastDesktopNotification < RATE_LIMIT_MS) return;
    lastDesktopNotification = now;

    const title = `agenttop: ${alert.severity} alert`;
    const body = `${alert.sessionSlug}: ${alert.message.slice(0, 100)}`;

    const os = platform();
    if (os === 'linux') {
      execFile('notify-send', [title, body], { timeout: 3000 });
    } else if (os === 'darwin') {
      execFile(
        'osascript',
        ['-e', `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`],
        { timeout: 3000 },
      );
    }
  }
};
