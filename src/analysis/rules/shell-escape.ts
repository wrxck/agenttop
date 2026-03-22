import type { ToolCall, Alert } from '../../discovery/types.js';

const SHELL_PATTERNS: Array<{ pattern: RegExp; severity: 'high' | 'critical'; label: string }> = [
  { pattern: /\beval\s*[("']/, severity: 'high', label: 'eval execution' },
  { pattern: /\bchmod\s+777\b/, severity: 'high', label: 'chmod 777' },
  { pattern: /\bchmod\s+\+s\b/, severity: 'critical', label: 'setuid chmod' },
  { pattern: /\bsudo\b/, severity: 'high', label: 'sudo usage' },
  { pattern: /\bsu\s+-?\s*\w/, severity: 'high', label: 'su usage' },
  { pattern: />\s*\/etc\//, severity: 'critical', label: 'writing to /etc/' },
  { pattern: />\s*\/usr\//, severity: 'critical', label: 'writing to /usr/' },
  { pattern: /--privileged/, severity: 'critical', label: 'privileged flag' },
  { pattern: /\brm\s+-rf\s+\/(?!\w)/, severity: 'critical', label: 'rm -rf /' },
  { pattern: /\bdd\s+.*of=\/dev\//, severity: 'critical', label: 'dd to device' },
  { pattern: /\bmkfs\b/, severity: 'critical', label: 'filesystem format' },
  { pattern: /\biptables\b/, severity: 'high', label: 'firewall modification' },
];

export const checkShellEscape = (call: ToolCall): Alert | null => {
  if (call.toolName !== 'Bash') return null;

  const command = String(call.toolInput.command || '');

  for (const rule of SHELL_PATTERNS) {
    if (rule.pattern.test(command)) {
      return {
        id: `shell-${call.timestamp}-${call.agentId}`,
        severity: rule.severity,
        rule: 'shell-escape',
        message: `${rule.label}: ${command.slice(0, 80)}`,
        sessionSlug: call.slug,
        sessionId: call.sessionId,
        event: call,
        timestamp: call.timestamp,
      };
    }
  }

  return null;
};
