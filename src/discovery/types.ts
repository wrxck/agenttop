export interface TokenUsage {
  inputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

export type SessionStatus = 'waiting' | 'stale' | 'active' | 'inactive';

export const STATUS_PRIORITY: Record<SessionStatus, number> = {
  waiting: 0,
  stale: 1,
  active: 2,
  inactive: 3,
};

export interface Session {
  sessionId: string;
  slug: string;
  project: string;
  cwd: string;
  model: string;
  version: string;
  gitBranch: string;
  pid: number | null;
  cpu: number;
  mem: number;
  memMB: number;
  agentCount: number;
  agentIds: string[];
  outputFiles: string[];
  startTime: number;
  lastActivity: number;
  usage: TokenUsage;
  nickname?: string;
  status: SessionStatus;
}

export interface ToolCall {
  sessionId: string;
  agentId: string;
  slug: string;
  timestamp: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolUseId?: string;
  cwd: string;
}

export interface ActivityEvent {
  call: ToolCall;
  result?: ToolResult;
}

export interface ToolResult {
  sessionId: string;
  agentId: string;
  slug: string;
  timestamp: number;
  toolUseId: string;
  content: string;
  isError: boolean;
  cwd: string;
}

export type SecurityEvent = ToolCall | ToolResult;

export const isToolResult = (event: SecurityEvent): event is ToolResult => 'toolUseId' in event;

export const isToolCall = (event: SecurityEvent): event is ToolCall => 'toolName' in event;

export interface RawEvent {
  type: 'user' | 'assistant' | 'tool_result';
  sessionId: string;
  agentId: string;
  slug: string;
  timestamp?: string;
  cwd: string;
  version: string;
  gitBranch: string;
  message: {
    role: string;
    content: unknown;
    model?: string;
    usage?: {
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens?: number;
    };
  };
}

export type AlertSeverity = 'info' | 'warn' | 'high' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  rule: string;
  message: string;
  sessionSlug: string;
  sessionId: string;
  event: SecurityEvent;
  timestamp: number;
}

export interface SessionGroup {
  key: string;
  sessions: Session[];
  expanded: boolean;
  // aggregated fields for group header
  totalInputTokens: number;
  totalOutputTokens: number;
  latestModel: string;
  status: SessionStatus;
  latestActivity: number;
  earliestStart: number;
}

export type VisibleItem =
  | { type: 'group'; group: SessionGroup }
  | { type: 'session'; session: Session; groupKey: string }
  | { type: 'ungrouped'; session: Session };

export interface ProcessInfo {
  pid: number;
  cpu: number;
  mem: number;
  memKB: number;
  command: string;
  startTime: string;
  cwd: string;
}

export interface CLIOptions {
  allUsers: boolean;
  noSecurity: boolean;
  json: boolean;
  plain: boolean;
  alertLevel: AlertSeverity;
  installHooks: boolean;
  uninstallHooks: boolean;
  help: boolean;
  version: boolean;
  noNotify: boolean;
  noAlertLog: boolean;
  noUpdates: boolean;
  pollInterval: number;
  mcp: boolean;
  installMcp: boolean;
}
