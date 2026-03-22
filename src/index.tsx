import React from 'react';
import { render } from 'ink';

import type { AlertSeverity, CLIOptions, ToolCall, SecurityEvent } from './discovery/types.js';
import { discoverSessions } from './discovery/sessions.js';
import { Watcher } from './ingestion/watcher.js';
import { SecurityEngine } from './analysis/security.js';
import { App } from './ui/App.js';
import { installHooks, uninstallHooks } from './hooks/installer.js';

const VERSION = '1.0.0';

const HELP = `agenttop v${VERSION} -- Real-time dashboard for AI coding agent sessions

Usage: agenttop [options]

Options:
  --all-users         Monitor all users (root only)
  --no-security       Disable security analysis
  --json              Stream events as JSON (no TUI)
  --alert-level <l>   Minimum: info|warn|high|critical (default: warn)
  --install-hooks     Install Claude Code PostToolUse hook for active protection
  --uninstall-hooks   Remove agenttop hooks from Claude Code
  --version           Show version
  --help              Show this help
`;

const write = (msg: string): void => {
  process.stdout.write(msg + '\n');
};

const parseArgs = (argv: string[]): CLIOptions => {
  const args = argv.slice(2);
  const options: CLIOptions = {
    allUsers: false,
    noSecurity: false,
    json: false,
    alertLevel: 'warn',
    installHooks: false,
    uninstallHooks: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all-users':
        options.allUsers = true;
        break;
      case '--no-security':
        options.noSecurity = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--alert-level':
        i++;
        if (['info', 'warn', 'high', 'critical'].includes(args[i])) {
          options.alertLevel = args[i] as AlertSeverity;
        }
        break;
      case '--install-hooks':
        options.installHooks = true;
        break;
      case '--uninstall-hooks':
        options.uninstallHooks = true;
        break;
      case '--version':
        options.version = true;
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
};

const runJsonMode = (options: CLIOptions): void => {
  const engine = options.noSecurity ? null : new SecurityEngine(options.alertLevel);

  const sessions = discoverSessions(options.allUsers);
  write(JSON.stringify({ type: 'sessions', data: sessions }));

  const handler = (calls: ToolCall[]) => {
    for (const call of calls) {
      write(JSON.stringify({ type: 'tool_call', data: call }));
    }
  };

  const securityHandler = engine
    ? (events: SecurityEvent[]) => {
        for (const event of events) {
          const alerts = engine.analyzeEvent(event);
          for (const alert of alerts) {
            write(JSON.stringify({ type: 'alert', data: alert }));
          }
        }
      }
    : undefined;

  const watcher = new Watcher(handler, options.allUsers, securityHandler);
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

const main = () => {
  const options = parseArgs(process.argv);

  if (options.version) {
    write(`agenttop v${VERSION}`);
    process.exit(0);
  }

  if (options.help) {
    write(HELP);
    process.exit(0);
  }

  if (options.installHooks) {
    installHooks();
    process.exit(0);
  }

  if (options.uninstallHooks) {
    uninstallHooks();
    process.exit(0);
  }

  if (options.json) {
    runJsonMode(options);
    return;
  }

  render(React.createElement(App, { options }));
};

main();
