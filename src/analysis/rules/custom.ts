import type { SecurityEvent, Alert } from '../../discovery/types.js';
import { isToolCall, isToolResult } from '../../discovery/types.js';
import type { CustomAlertRule } from '../../config/store.js';

type SecurityEventRule = (event: SecurityEvent) => Alert | null;

export const createCustomRules = (rules: CustomAlertRule[]): SecurityEventRule[] => {
  const compiled: SecurityEventRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern);
    } catch {
      continue;
    }

    const fn: SecurityEventRule = (event: SecurityEvent): Alert | null => {
      let matched = false;
      if (isToolCall(event)) {
        if (rule.match === 'output') return null;
        if (rule.match === 'toolName' || rule.match === 'all') {
          if (regex.test(event.toolName)) matched = true;
        }
        if (!matched && (rule.match === 'input' || rule.match === 'all')) {
          if (regex.test(JSON.stringify(event.toolInput))) matched = true;
        }
      }
      if (isToolResult(event)) {
        if (rule.match === 'input' || rule.match === 'toolName') return null;
        if (rule.match === 'output' || rule.match === 'all') {
          if (regex.test(event.content)) matched = true;
        }
      }
      if (!matched) return null;
      return {
        id: `custom-${rule.name}-${event.timestamp}`,
        severity: rule.severity,
        rule: `custom:${rule.name}`,
        message: rule.message || rule.name,
        sessionSlug: 'slug' in event ? event.slug : '',
        sessionId: 'sessionId' in event ? event.sessionId : '',
        event,
        timestamp: event.timestamp,
      };
    };
    compiled.push(fn);
  }
  return compiled;
};
