import type { ToolCall, Alert } from '../../discovery/types.js';

const NETWORK_PATTERNS = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bfetch\s*\(/,
  /\bnc\b/,
  /\bnetcat\b/,
  /\bpython3?\s+-m\s+http\.server\b/,
  /\bncat\b/,
  /\bsocat\b/,
  /\btelnet\b/,
];

const LOCALHOST = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])\b/;

export const checkNetwork = (call: ToolCall): Alert | null => {
  if (call.toolName !== 'Bash') return null;

  const command = String(call.toolInput.command || '');
  const matched = NETWORK_PATTERNS.some((p) => p.test(command));
  if (!matched) return null;

  const isLocal = LOCALHOST.test(command);
  const severity = isLocal ? 'info' : 'warn';

  return {
    id: `net-${call.timestamp}-${call.agentId}`,
    severity,
    rule: 'network',
    message: isLocal
      ? `Network command to localhost: ${command.slice(0, 80)}`
      : `Network command to external target: ${command.slice(0, 80)}`,
    sessionSlug: call.slug,
    sessionId: call.sessionId,
    event: call,
    timestamp: call.timestamp,
  };
};
