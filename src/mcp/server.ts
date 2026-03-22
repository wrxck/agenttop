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
import { loadConfig, saveConfig, resolveAlertLogPath, pinSession, unpinSession } from '../config/store.js';

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
      {
        name: 'agenttop_waiting_sessions',
        description: 'List sessions in waiting or stale state',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'agenttop_session_status',
        description: 'Get status for a session',
        inputSchema: {
          type: 'object' as const,
          properties: { sessionId: { type: 'string' } },
          required: ['sessionId'],
        },
      },
      {
        name: 'agenttop_custom_alerts',
        description: 'List custom alert rules',
        inputSchema: { type: 'object' as const, properties: {} },
      },
      {
        name: 'agenttop_set_custom_alert',
        description: 'Add or update a custom alert rule',
        inputSchema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' },
            pattern: { type: 'string' },
            match: { type: 'string', enum: ['input', 'output', 'toolName', 'all'] },
            severity: { type: 'string', enum: ['info', 'warn', 'high', 'critical'] },
            message: { type: 'string' },
          },
          required: ['name', 'pattern'],
        },
      },
      {
        name: 'agenttop_delete_custom_alert',
        description: 'Delete a custom alert rule',
        inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } }, required: ['name'] },
      },
      {
        name: 'agenttop_alert_history',
        description: 'Get recent alerts with severity filter',
        inputSchema: {
          type: 'object' as const,
          properties: {
            severity: { type: 'string', enum: ['info', 'warn', 'high', 'critical'] },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'agenttop_set_stale_timeout',
        description: 'Set stale timeout in seconds',
        inputSchema: { type: 'object' as const, properties: { seconds: { type: 'number' } }, required: ['seconds'] },
      },
      {
        name: 'agenttop_pin_session',
        description: 'Pin a session to top',
        inputSchema: {
          type: 'object' as const,
          properties: { sessionId: { type: 'string' } },
          required: ['sessionId'],
        },
      },
      {
        name: 'agenttop_unpin_session',
        description: 'Unpin a session',
        inputSchema: {
          type: 'object' as const,
          properties: { sessionId: { type: 'string' } },
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
          status: s.status,
          pinned: s.pinned,
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

      case 'agenttop_waiting_sessions': {
        const sessions = discoverSessions(allUsers);
        const waiting = sessions
          .filter((s) => s.status === 'waiting' || s.status === 'stale')
          .map((s) => ({
            sessionId: s.sessionId,
            slug: s.slug,
            status: s.status,
            cwd: s.cwd,
            model: s.model,
            idleSeconds: Math.round((Date.now() - s.lastActivity) / 1000),
          }));
        return { content: [{ type: 'text', text: JSON.stringify(waiting, null, 2) }] };
      }
      case 'agenttop_session_status': {
        const sid = args?.sessionId as string;
        const sessions = discoverSessions(allUsers);
        const session = sessions.find((s) => s.sessionId === sid);
        if (!session) return { content: [{ type: 'text', text: `Session not found: ${sid}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({ sessionId: sid, status: session.status }) }] };
      }
      case 'agenttop_custom_alerts': {
        const cfg = loadConfig();
        return { content: [{ type: 'text', text: JSON.stringify(cfg.alerts.custom ?? [], null, 2) }] };
      }
      case 'agenttop_set_custom_alert': {
        const name = args?.name as string;
        const pattern = args?.pattern as string;
        try {
          new RegExp(pattern);
        } catch {
          return { content: [{ type: 'text', text: `Invalid regex: ${pattern}` }], isError: true };
        }
        const cfg = loadConfig();
        const custom = [...(cfg.alerts.custom ?? [])];
        const existing = custom.findIndex((r) => r.name === name);
        const rule = {
          name,
          pattern,
          match: ((args?.match as string) ?? 'all') as 'input' | 'output' | 'toolName' | 'all',
          severity: ((args?.severity as string) ?? 'warn') as 'info' | 'warn' | 'high' | 'critical',
          message: (args?.message as string) ?? name,
          enabled: true,
        };
        if (existing >= 0) custom[existing] = rule;
        else custom.push(rule);
        cfg.alerts.custom = custom;
        saveConfig(cfg);
        return { content: [{ type: 'text', text: `Rule '${name}' saved` }] };
      }
      case 'agenttop_delete_custom_alert': {
        const name = args?.name as string;
        const cfg = loadConfig();
        cfg.alerts.custom = (cfg.alerts.custom ?? []).filter((r) => r.name !== name);
        saveConfig(cfg);
        return { content: [{ type: 'text', text: `Rule '${name}' deleted` }] };
      }
      case 'agenttop_alert_history': {
        const severity = (args?.severity as string) ?? 'info';
        const limit = (args?.limit as number) ?? 50;
        const order: Record<string, number> = { info: 0, warn: 1, high: 2, critical: 3 };
        const minOrder = order[severity] ?? 0;
        const cfg = loadConfig();
        const logPath = resolveAlertLogPath(cfg);
        const logAlerts: { severity: string; rule: string; message: string; sessionSlug: string; timestamp: string }[] =
          [];
        try {
          const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const a = JSON.parse(line);
              if ((order[a.severity] ?? 0) >= minOrder)
                logAlerts.push({
                  severity: a.severity,
                  rule: a.rule,
                  message: a.message,
                  sessionSlug: a.sessionSlug,
                  timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : 'unknown',
                });
            } catch {
              continue;
            }
          }
        } catch {
          /* no log file */
        }
        for (const a of alerts) {
          if ((order[a.severity] ?? 0) >= minOrder)
            logAlerts.push({
              severity: a.severity,
              rule: a.rule,
              message: a.message,
              sessionSlug: a.sessionSlug,
              timestamp: new Date(a.timestamp).toISOString(),
            });
        }
        return { content: [{ type: 'text', text: JSON.stringify(logAlerts.slice(-limit), null, 2) }] };
      }
      case 'agenttop_set_stale_timeout': {
        const seconds = Math.max(15, (args?.seconds as number) ?? 60);
        const cfg = loadConfig();
        cfg.alerts.staleTimeout = seconds;
        saveConfig(cfg);
        return { content: [{ type: 'text', text: `Stale timeout set to ${seconds}s` }] };
      }
      case 'agenttop_pin_session': {
        pinSession(args?.sessionId as string);
        return { content: [{ type: 'text', text: `Session pinned` }] };
      }
      case 'agenttop_unpin_session': {
        unpinSession(args?.sessionId as string);
        return { content: [{ type: 'text', text: `Session unpinned` }] };
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
