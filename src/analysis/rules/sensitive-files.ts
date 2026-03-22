import type { ToolCall, Alert } from '../../discovery/types.js';

const SENSITIVE_PATTERNS = [
  /\.env\b/,
  /\.env\.\w+/,
  /\.ssh\//,
  /id_rsa/,
  /id_ed25519/,
  /\.pem$/,
  /\.key$/,
  /credentials/i,
  /\/etc\/shadow/,
  /\/etc\/passwd/,
  /\.aws\/credentials/,
  /\.kube\/config/,
  /\.docker\/config\.json/,
  /\.npmrc/,
  /\.pypirc/,
  /\.netrc/,
  /secrets?\.\w+/i,
  /token\.\w+/i,
];

const TOOLS_THAT_READ = ['Read', 'Bash', 'Grep', 'Glob'];

export const checkSensitiveFiles = (call: ToolCall): Alert | null => {
  if (!TOOLS_THAT_READ.includes(call.toolName)) return null;

  const inputs = JSON.stringify(call.toolInput);
  const matched = SENSITIVE_PATTERNS.some((p) => p.test(inputs));
  if (!matched) return null;

  const target =
    String(call.toolInput.file_path || call.toolInput.command || call.toolInput.pattern || '').slice(0, 60);

  return {
    id: `sens-${call.timestamp}-${call.agentId}`,
    severity: 'warn',
    rule: 'sensitive-files',
    message: `Accessing sensitive file: ${target}`,
    sessionSlug: call.slug,
    sessionId: call.sessionId,
    event: call,
    timestamp: call.timestamp,
  };
};
