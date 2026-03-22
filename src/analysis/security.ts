import type { ToolCall, ToolResult, SecurityEvent, Alert, AlertSeverity } from '../discovery/types.js';
import { isToolCall } from '../discovery/types.js';
import type { SecurityRulesConfig, CustomAlertRule } from '../config/store.js';

import { checkNetwork } from './rules/network.js';
import { checkExfiltration } from './rules/exfiltration.js';
import { checkSensitiveFiles } from './rules/sensitive-files.js';
import { checkShellEscape } from './rules/shell-escape.js';
import { checkInjection } from './rules/injection.js';
import { createCustomRules } from './rules/custom.js';

type ToolCallRule = (call: ToolCall) => Alert | null;
type SecurityEventRule = (event: SecurityEvent) => Alert | null;

interface NamedRule<T> {
  key: keyof SecurityRulesConfig;
  fn: T;
}

const toolCallRules: NamedRule<ToolCallRule>[] = [
  { key: 'network', fn: checkNetwork },
  { key: 'exfiltration', fn: checkExfiltration },
  { key: 'sensitiveFiles', fn: checkSensitiveFiles },
  { key: 'shellEscape', fn: checkShellEscape },
];

const allEventRules: NamedRule<SecurityEventRule>[] = [{ key: 'injection', fn: checkInjection }];

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
  private rulesConfig: SecurityRulesConfig;
  private customEventRules: SecurityEventRule[] = [];

  constructor(minLevel: AlertSeverity = 'warn', rulesConfig?: SecurityRulesConfig, customRules?: CustomAlertRule[]) {
    this.minLevel = minLevel;
    this.rulesConfig = rulesConfig ?? {
      network: true,
      exfiltration: true,
      sensitiveFiles: true,
      shellEscape: true,
      injection: true,
    };
    if (customRules?.length) {
      this.customEventRules = createCustomRules(customRules);
    }
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
        if (!this.rulesConfig[rule.key]) continue;
        const alert = rule.fn(event);
        if (alert) alerts.push(alert);
      }
    }

    for (const rule of allEventRules) {
      if (!this.rulesConfig[rule.key]) continue;
      const alert = rule.fn(event);
      if (alert) alerts.push(alert);
    }

    for (const fn of this.customEventRules) {
      const alert = fn(event);
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
