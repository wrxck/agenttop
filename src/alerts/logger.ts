import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Alert } from '../discovery/types.js';
import { resolveAlertLogPath, rotateLogFile } from '../config/store.js';
import type { Config } from '../config/store.js';

export class AlertLogger {
  private logPath: string;
  private writeCount = 0;

  constructor(config: Config) {
    this.logPath = resolveAlertLogPath(config);
    mkdirSync(dirname(this.logPath), { recursive: true });
  }

  log(alert: Alert): void {
    const entry = {
      timestamp: new Date(alert.timestamp).toISOString(),
      severity: alert.severity,
      rule: alert.rule,
      message: alert.message,
      sessionSlug: alert.sessionSlug,
      sessionId: alert.sessionId,
    };

    try {
      appendFileSync(this.logPath, JSON.stringify(entry) + '\n');
      this.writeCount++;
      if (this.writeCount % 100 === 0) {
        rotateLogFile(this.logPath);
      }
    } catch {
      // silently ignore write errors
    }
  }
}
