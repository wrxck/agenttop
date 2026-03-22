import type { ToolCall, ToolResult, Alert, SecurityEvent } from '../../discovery/types.js';
import { isToolResult, isToolCall } from '../../discovery/types.js';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s*:\s*you/i,
  /\bdo\s+not\s+follow\s+(your|the)\s+(original|previous)/i,
  /override\s+(your\s+)?(instructions|rules|guidelines)/i,
  /forget\s+(your\s+)?(instructions|rules|guidelines)/i,
  /act\s+as\s+(if\s+)?(you\s+are|a)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /\bAI\s+assistant\b.*\bmust\b/i,
  /\bhuman\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /<\s*system\s*>/i,
  /\[\s*INST\s*\]/i,
  /BEGIN\s+HIDDEN\s+INSTRUCTIONS/i,
];

const ENCODED_PATTERNS = [
  /aWdub3JlIHByZXZpb3Vz/, // base64 "ignore previous"
  /&#x[0-9a-f]+;/i, // html hex entities
  /&#\d+;/, // html decimal entities
  /\\u[0-9a-f]{4}/i, // unicode escapes
];

export const checkInjection = (event: SecurityEvent): Alert | null => {
  if (isToolCall(event)) {
    return checkToolCallInjection(event);
  }
  if (isToolResult(event)) {
    return checkToolResultInjection(event);
  }
  return null;
};

const checkToolCallInjection = (call: ToolCall): Alert | null => {
  const inputs = JSON.stringify(call.toolInput);

  const matched = INJECTION_PATTERNS.some((p) => p.test(inputs));
  if (!matched) return null;

  return {
    id: `inject-call-${call.timestamp}-${call.agentId}`,
    severity: 'critical',
    rule: 'injection',
    message: `Prompt injection in ${call.toolName} input`,
    sessionSlug: call.slug,
    sessionId: call.sessionId,
    event: call,
    timestamp: call.timestamp,
  };
};

const checkToolResultInjection = (result: ToolResult): Alert | null => {
  const content = result.content;
  if (!content || content.length < 10) return null;

  const textPatternMatch = INJECTION_PATTERNS.some((p) => p.test(content));
  const encodedMatch = ENCODED_PATTERNS.some((p) => p.test(content));

  if (!textPatternMatch && !encodedMatch) return null;

  const matchedPattern = INJECTION_PATTERNS.find((p) => p.test(content));
  const snippet = matchedPattern ? content.match(matchedPattern)?.[0]?.slice(0, 50) || '' : 'encoded pattern';

  return {
    id: `inject-result-${result.timestamp}-${result.agentId}`,
    severity: 'critical',
    rule: 'injection-in-result',
    message: `Prompt injection in tool result: "${snippet}"`,
    sessionSlug: result.slug,
    sessionId: result.sessionId,
    event: result,
    timestamp: result.timestamp,
  };
};
