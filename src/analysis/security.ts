import type { ToolCall, ToolResult, SecurityEvent, Alert, AlertSeverity } from '../discovery/types.js';
import { isToolCall } from '../discovery/types.js';

import { checkNetwork } from './rules/network.js';
import { checkExfiltration } from './rules/exfiltration.js';
import { checkSensitiveFiles } from './rules/sensitive-files.js';
import { checkShellEscape } from './rules/shell-escape.js';
import { checkInjection } from './rules/injection.js';

type ToolCallRule = (call: ToolCall) => Alert | null;
type SecurityEventRule = (event: SecurityEvent) => Alert | null;

const toolCallRules: ToolCallRule[] = [
  checkNetwork,
  checkExfiltration,
  checkSensitiveFiles,
  checkShellEscape,
];

const allEventRules: SecurityEventRule[] = [
  checkInjection,
];

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  info: 0,
  warn: 1,
  high: 2,
  critical: 3,
};

const DEDUP_WINDOW_MS = 30_000;

export class SecurityEngine {
  private recentAlerts = new Map<string, number>();
  private minLevel: AlertSeverity;

  constructor(minLevel: AlertSeverity = 'warn') {
    this.minLevel = minLevel;
  }

  analyze(call: ToolCall): Alert[] {
    return this.analyzeEvent(call);
  }

  analyzeResult(result: ToolResult): Alert[] {
    return this.analyzeEvent(result);
  }

  analyzeEvent(event: SecurityEvent): Alert[] {
    const alerts: Alert[] = [];

    if (isToolCall(event)) {
      for (const rule of toolCallRules) {
        const alert = rule(event);
        if (alert) alerts.push(alert);
      }
    }

    for (const rule of allEventRules) {
      const alert = rule(event);
      if (alert) alerts.push(alert);
    }

    return alerts.filter((alert) => {
      if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[this.minLevel]) return false;

      const dedupKey = `${alert.rule}-${alert.sessionId}-${alert.message.slice(0, 40)}`;
      const lastSeen = this.recentAlerts.get(dedupKey);
      if (lastSeen && alert.timestamp - lastSeen < DEDUP_WINDOW_MS) return false;

      this.recentAlerts.set(dedupKey, alert.timestamp);
      return true;
    });
  }

  pruneOldAlerts(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS * 2;
    for (const [key, ts] of this.recentAlerts) {
      if (ts < cutoff) this.recentAlerts.delete(key);
    }
  }
}
