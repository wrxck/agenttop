import type { ToolCall, Alert } from '../../discovery/types.js';

const EXFIL_PATTERNS = [
  /base64.*\|\s*(curl|wget|nc)/,
  /cat\s+.*\|\s*(curl|wget|nc)/,
  /(tar|zip|gzip).*\|\s*(curl|wget|nc)/,
  /\bcurl\b.*-d\s*@/,
  /\bcurl\b.*--data-binary/,
  /\bscp\b/,
  /\brsync\b.*[^/]@/,
  />\s*\/dev\/tcp\//,
];

export const checkExfiltration = (call: ToolCall): Alert | null => {
  if (call.toolName !== 'Bash') return null;

  const command = String(call.toolInput.command || '');
  const matched = EXFIL_PATTERNS.some((p) => p.test(command));
  if (!matched) return null;

  return {
    id: `exfil-${call.timestamp}-${call.agentId}`,
    severity: 'high',
    rule: 'exfiltration',
    message: `Potential data exfiltration: ${command.slice(0, 80)}`,
    sessionSlug: call.slug,
    sessionId: call.sessionId,
    event: call,
    timestamp: call.timestamp,
  };
};
