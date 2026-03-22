import type { RawEvent, ToolCall, ToolResult, SecurityEvent, TokenUsage } from '../discovery/types.js';

const parseEventTimestamp = (event: RawEvent): number => {
  if (event.timestamp) {
    const parsed = new Date(event.timestamp).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
};

export const parseLine = (line: string): RawEvent | null => {
  try {
    return JSON.parse(line) as RawEvent;
  } catch {
    return null;
  }
};

export const extractToolCalls = (event: RawEvent): ToolCall[] => {
  if (event.type !== 'assistant') return [];

  const content = event.message?.content;
  if (!Array.isArray(content)) return [];

  const ts = parseEventTimestamp(event);
  const calls: ToolCall[] = [];

  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block as Record<string, unknown>).type === 'tool_use'
    ) {
      const toolBlock = block as Record<string, unknown>;
      calls.push({
        sessionId: event.sessionId,
        agentId: event.agentId,
        slug: ((event as Record<string, unknown>).slug as string) || '',
        timestamp: ts,
        toolName: (toolBlock.name as string) || 'unknown',
        toolInput: (toolBlock.input as Record<string, unknown>) || {},
        cwd: event.cwd,
      });
    }
  }

  return calls;
};

export const extractToolResults = (event: RawEvent): ToolResult[] => {
  if (event.type !== 'user') return [];

  const content = event.message?.content;
  if (!Array.isArray(content)) return [];

  const ts = parseEventTimestamp(event);
  const results: ToolResult[] = [];

  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      'type' in block &&
      (block as Record<string, unknown>).type === 'tool_result'
    ) {
      const resultBlock = block as Record<string, unknown>;
      const resultContent = resultBlock.content;
      let text = '';
      if (typeof resultContent === 'string') {
        text = resultContent;
      } else if (Array.isArray(resultContent)) {
        text = resultContent
          .map((c) => (typeof c === 'object' && c !== null ? (c as Record<string, unknown>).text || '' : String(c)))
          .join('\n');
      }

      results.push({
        sessionId: event.sessionId,
        agentId: event.agentId,
        slug: ((event as Record<string, unknown>).slug as string) || '',
        timestamp: ts,
        toolUseId: String(resultBlock.tool_use_id || ''),
        content: text,
        isError: Boolean(resultBlock.is_error),
        cwd: event.cwd,
      });
    }
  }

  return results;
};

export const extractUsage = (event: RawEvent): TokenUsage | null => {
  if (event.type !== 'assistant') return null;

  const usage = event.message?.usage;
  if (!usage) return null;

  return {
    inputTokens: usage.input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  };
};

export const parseLines = (lines: string[]): ToolCall[] => {
  const calls: ToolCall[] = [];
  for (const line of lines) {
    const event = parseLine(line);
    if (event) {
      calls.push(...extractToolCalls(event));
    }
  }
  return calls;
};

export const parseAllEvents = (lines: string[]): SecurityEvent[] => {
  const events: SecurityEvent[] = [];
  for (const line of lines) {
    const event = parseLine(line);
    if (event) {
      events.push(...extractToolCalls(event));
      events.push(...extractToolResults(event));
    }
  }
  return events;
};

export const parseUsageFromLines = (lines: string[]): TokenUsage => {
  const total: TokenUsage = { inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 };
  for (const line of lines) {
    const event = parseLine(line);
    if (event) {
      const usage = extractUsage(event);
      if (usage) {
        total.inputTokens += usage.inputTokens;
        total.cacheCreationTokens += usage.cacheCreationTokens;
        total.cacheReadTokens += usage.cacheReadTokens;
        total.outputTokens += usage.outputTokens;
      }
    }
  }
  return total;
};
