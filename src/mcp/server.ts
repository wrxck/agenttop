import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { discoverSessions } from '../discovery/sessions.js';
import type { Alert, AlertSeverity, SecurityEvent, ToolCall } from '../discovery/types.js';
import { SecurityEngine } from '../analysis/security.js';
import { Watcher } from '../ingestion/watcher.js';

const MAX_ALERTS = 100;
const MAX_ACTIVITY = 200;

const getVersion = (): string => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const pkgPath = join(dirname(thisFile), '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

export const startMcpServer = async (allUsers: boolean, noSecurity: boolean): Promise<void> => {
  const alerts: Alert[] = [];
  const activity = new Map<string, ToolCall[]>();
  const engine = noSecurity ? null : new SecurityEngine('info');

  const toolHandler = (calls: ToolCall[]) => {
    for (const call of calls) {
      const existing = activity.get(call.sessionId) ?? [];
      existing.push(call);
      if (existing.length > MAX_ACTIVITY) existing.splice(0, existing.length - MAX_ACTIVITY);
      activity.set(call.sessionId, existing);
    }
  };

  const securityHandler = engine
    ? (events: SecurityEvent[]) => {
        for (const event of events) {
          const newAlerts = engine.analyzeEvent(event);
          alerts.push(...newAlerts);
          if (alerts.length > MAX_ALERTS) alerts.splice(0, alerts.length - MAX_ALERTS);
        }
      }
    : undefined;

  const watcher = new Watcher(toolHandler, allUsers, securityHandler);
  watcher.start();

  const server = new Server(
    { name: 'agenttop', version: getVersion() },
    {
      capabilities: { tools: {} },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'agenttop_sessions',
        description: 'List active Claude Code sessions with model, CPU, MEM, tokens, nickname',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'agenttop_alerts',
        description: 'Get recent security alerts, optionally filtered by severity',
        inputSchema: {
          type: 'object' as const,
          properties: {
            severity: {
              type: 'string',
              enum: ['info', 'warn', 'high', 'critical'],
              description: 'Minimum severity filter',
            },
            limit: { type: 'number', description: 'Max alerts to return (default 20)' },
          },
        },
      },
      {
        name: 'agenttop_usage',
        description: 'Get token usage for a session or all sessions',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sessionId: { type: 'string', description: 'Session ID (omit for all)' },
          },
        },
      },
      {
        name: 'agenttop_activity',
        description: 'Get recent tool calls for a session',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            limit: { type: 'number', description: 'Max events to return (default 20)' },
          },
          required: ['sessionId'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'agenttop_sessions': {
        const sessions = discoverSessions(allUsers);
        const data = sessions.map((s) => ({
          sessionId: s.sessionId,
          slug: s.slug,
          model: s.model,
          cwd: s.cwd,
          cpu: s.cpu,
          memMB: s.memMB,
          agents: s.agentCount,
          tokens: { input: s.usage.inputTokens, output: s.usage.outputTokens, cacheRead: s.usage.cacheReadTokens },
        }));
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'agenttop_alerts': {
        const severity = (args?.severity as AlertSeverity) ?? 'info';
        const limit = (args?.limit as number) ?? 20;
        const order: Record<string, number> = { info: 0, warn: 1, high: 2, critical: 3 };
        const minOrder = order[severity] ?? 0;
        const filtered = alerts
          .filter((a) => (order[a.severity] ?? 0) >= minOrder)
          .slice(-limit)
          .map((a) => ({
            severity: a.severity,
            rule: a.rule,
            message: a.message,
            sessionSlug: a.sessionSlug,
            timestamp: new Date(a.timestamp).toISOString(),
          }));
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'agenttop_usage': {
        const sessions = discoverSessions(allUsers);
        const sessionId = args?.sessionId as string | undefined;
        const targets = sessionId ? sessions.filter((s) => s.sessionId === sessionId) : sessions;
        const data = targets.map((s) => ({
          sessionId: s.sessionId,
          slug: s.slug,
          usage: s.usage,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'agenttop_activity': {
        const sid = args?.sessionId as string;
        const limit = (args?.limit as number) ?? 20;
        const events = (activity.get(sid) ?? []).slice(-limit).map((e) => ({
          timestamp: new Date(e.timestamp).toISOString(),
          tool: e.toolName,
          input: e.toolInput,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', () => {
    watcher.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    watcher.stop();
    process.exit(0);
  });
};
