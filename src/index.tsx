import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { render } from 'ink';

import type { AlertSeverity, CLIOptions } from './discovery/types.js';
import { App } from './ui/App.js';
import { installHooks, uninstallHooks } from './hooks/installer.js';
import { loadConfig, saveConfig, isFirstRun } from './config/store.js';
import { startMcpServer } from './mcp/server.js';
import { runStreamMode } from './stream.js';
import { installMcpConfig } from './install-mcp.js';

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

const VERSION = getVersion();

const HELP = `agenttop v${VERSION} -- Real-time dashboard for AI coding agent sessions

Usage: agenttop [options]

Options:
  --all-users          Monitor all users (root only)
  --no-security        Disable security analysis
  --json               Stream events as JSON lines (no TUI)
  --plain              Stream events as plain text (no TUI)
  --alert-level <l>    Minimum: info|warn|high|critical (default: warn)
  --no-notify          Disable all notifications
  --no-alert-log       Disable alert file logging
  --no-updates         Disable update checks
  --poll-interval <ms> Session discovery interval (default: 10000)
  --mcp                Start as MCP server (for Claude Code integration)
  --install-mcp        Register agenttop as MCP server in Claude Code
  --install-hooks      Install Claude Code PostToolUse hook for active protection
  --uninstall-hooks    Remove agenttop hooks from Claude Code
  --version            Show version
  --help               Show this help

Streaming modes (--json / --plain):
  Stream session events to stdout for piping into other tools.
  --json outputs one JSON object per line (JSONL format).
  --plain outputs human-readable lines.

  Examples:
    agenttop --json | jq 'select(.type == "alert")'
    agenttop --plain | grep ALERT
    agenttop --json --no-security   # stream tool calls only
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
    plain: false,
    alertLevel: 'warn',
    installHooks: false,
    uninstallHooks: false,
    help: false,
    version: false,
    noNotify: false,
    noAlertLog: false,
    noUpdates: false,
    pollInterval: 10000,
    mcp: false,
    installMcp: false,
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
      case '--plain':
        options.plain = true;
        break;
      case '--alert-level':
        i++;
        if (['info', 'warn', 'high', 'critical'].includes(args[i])) {
          options.alertLevel = args[i] as AlertSeverity;
        }
        break;
      case '--no-notify':
        options.noNotify = true;
        break;
      case '--no-alert-log':
        options.noAlertLog = true;
        break;
      case '--no-updates':
        options.noUpdates = true;
        break;
      case '--poll-interval':
        i++;
        {
          const n = parseInt(args[i], 10);
          if (n > 0) options.pollInterval = n;
        }
        break;
      case '--mcp':
        options.mcp = true;
        break;
      case '--install-mcp':
        options.installMcp = true;
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
  if (options.installMcp) {
    installMcpConfig();
    process.exit(0);
  }

  if (options.mcp) {
    startMcpServer(options.allUsers, options.noSecurity).catch((err) => {
      process.stderr.write(`mcp server error: ${err}\n`);
      process.exit(1);
    });
    return;
  }

  if (options.json || options.plain) {
    runStreamMode(options, options.json);
    return;
  }

  const config = loadConfig();
  const firstRun = isFirstRun();

  if (options.noNotify) {
    config.notifications.bell = false;
    config.notifications.desktop = false;
  }
  if (options.noAlertLog) config.alerts.enabled = false;
  if (options.noUpdates) config.updates.checkOnLaunch = false;
  if (options.noSecurity) config.security.enabled = false;

  if (firstRun) saveConfig(config);

  render(React.createElement(App, { options, config, version: VERSION, firstRun }));
};

main();
