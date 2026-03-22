import type { CLIOptions, ToolCall, SecurityEvent, TokenUsage } from './discovery/types.js';
import { discoverSessions } from './discovery/sessions.js';
import { Watcher } from './ingestion/watcher.js';
import { SecurityEngine } from './analysis/security.js';

const write = (msg: string): void => {
  process.stdout.write(msg + '\n');
};

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const runStreamMode = (options: CLIOptions, isJson: boolean): void => {
  const engine = options.noSecurity ? null : new SecurityEngine(options.alertLevel);

  const sessions = discoverSessions(options.allUsers);
  if (isJson) {
    write(JSON.stringify({ type: 'sessions', data: sessions }));
  } else {
    for (const s of sessions) {
      write(
        `SESSION ${s.slug} | ${s.model} | ${s.cwd} | CPU ${s.cpu}% | ${s.memMB}MB | ${formatTokens(s.usage.inputTokens)} in / ${formatTokens(s.usage.outputTokens)} out`,
      );
    }
  }

  const handler = (calls: ToolCall[]) => {
    for (const call of calls) {
      if (isJson) {
        write(JSON.stringify({ type: 'tool_call', data: call }));
      } else {
        const ts = new Date(call.timestamp).toLocaleTimeString('en-GB', { hour12: false });
        const input =
          call.toolName === 'Bash'
            ? String(call.toolInput.command || '').slice(0, 80)
            : JSON.stringify(call.toolInput).slice(0, 80);
        write(`${ts} ${call.slug} ${call.toolName.padEnd(8)} ${input}`);
      }
    }
  };

  const securityHandler = engine
    ? (events: SecurityEvent[]) => {
        for (const event of events) {
          const alerts = engine.analyzeEvent(event);
          for (const alert of alerts) {
            if (isJson) {
              write(JSON.stringify({ type: 'alert', data: alert }));
            } else {
              const ts = new Date(alert.timestamp).toLocaleTimeString('en-GB', { hour12: false });
              write(`ALERT ${ts} [${alert.severity}] ${alert.sessionSlug}: ${alert.message}`);
            }
          }
        }
      }
    : undefined;

  const usageHandler = (sessionId: string, usage: TokenUsage) => {
    if (isJson) {
      write(JSON.stringify({ type: 'usage', data: { sessionId, usage } }));
    } else {
      write(
        `USAGE ${sessionId.slice(0, 12)} +${formatTokens(usage.inputTokens)} in / +${formatTokens(usage.outputTokens)} out`,
      );
    }
  };

  const watcher = new Watcher(handler, options.allUsers, securityHandler, usageHandler);
  watcher.start();

  process.on('SIGINT', () => {
    watcher.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    watcher.stop();
    process.exit(0);
  });
};
