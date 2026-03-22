# agenttop

[![npm version](https://img.shields.io/npm/v/agenttop.svg)](https://www.npmjs.com/package/agenttop)
[![npm downloads](https://img.shields.io/npm/dm/agenttop.svg)](https://www.npmjs.com/package/agenttop)
[![CI](https://github.com/heskethwebdesign/agenttop/actions/workflows/ci.yml/badge.svg)](https://github.com/heskethwebdesign/agenttop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/agenttop.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/heskethwebdesign/agenttop/pulls)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/agenttop)](https://bundlephobia.com/package/agenttop)

Real-time terminal dashboard for monitoring AI coding agent sessions — like `htop` for agents.

Currently supports [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Reads local session data only — no network requests, no API keys.

> **Experimental** — this project is under active development. APIs and configuration may change between releases. Feature requests, bug reports, and contributions are very welcome. See [Contributing](#contributing).

## Table of contents

- [Install](#install)
- [Usage](#usage)
- [Token usage](#token-usage)
- [Session nicknames](#session-nicknames)
- [Session filtering](#session-filtering)
- [Session detail view](#session-detail-view)
- [Streaming modes](#streaming-modes)
- [Active protection](#active-protection)
- [Security rules](#security-rules)
- [MCP server](#mcp-server)
- [Notifications](#notifications)
- [Alert logging](#alert-logging)
- [Auto-updates](#auto-updates)
- [Configuration](#configuration)
- [Keybindings](#keybindings)
- [How it works](#how-it-works)
- [Multi-user support](#multi-user-support)
- [Contributing](#contributing)
- [Trademark notice](#trademark-notice)
- [License](#license)

## Install

```bash
npx agenttop
```

Or install globally:

```bash
npm install -g agenttop
```

## Usage

Run `agenttop` in one terminal while running Claude Code sessions in other tabs.

```
-- agenttop v0.3.0 ---- 3 sessions ---- 14:32:08 ---------------------
| SESSIONS                 | ACTIVITY (cuddly-wiggling-sundae)           |
|                          |                                             |
| > cuddly-wiggling-sundae | 14:32:05 Bash    ls /tmp/claude-0/         |
|   /home/matt | opus      | 14:32:03 Read    /root/.claude/CLAUDE.md   |
|   CPU 20% | 542MB | 3 ag | 14:31:58 Grep    pattern="sessionId"       |
|   1.2k in | 340 out      | 14:31:55 Write   /home/matt/app/src/...    |
|                          | 14:31:52 Bash    npm test                  |
|   jolly-dancing-pickle   |                                             |
|   /home/matt/fleet | son |                                             |
|--------------------------|---------------------------------------------|
| ALERTS                                                                 |
| [!] 14:31:52 jolly-dancing-pickle: curl to unknown external URL        |
| [!] 14:31:40 cuddly-wiggling-sundae: Reading .env file                 |
|-- q:quit  j/k:nav  tab:panel  /:filter  n:name  enter:detail ---------|
```

### Options

```
agenttop [options]

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
```

## Token usage

Each session displays real-time token consumption directly in the session list:

```
> cuddly-wiggling-sundae
  /home/matt | opus
  CPU 20% | 542MB | 3 ag
  1.2k in | 340 out
```

Press `Enter` on a session to see the full breakdown including cache creation, cache read, and cache hit rate percentage.

## Session nicknames

Press `n` on a selected session to assign a nickname. The nickname replaces the slug in the session list and persists across restarts.

Press `N` to clear a nickname.

Nicknames are stored in `~/.config/agenttop/config.json`.

## Session filtering

Press `/` to open the filter input. Type to filter sessions by slug, nickname, project, or model. Case-insensitive substring match.

Press `Esc` to clear the filter.

## Session detail view

Press `Enter` on a session to open the detail view, which shows:

- Slug, nickname, model, cwd, git branch, version, PID
- CPU, memory, uptime, agent count
- Full token usage breakdown with cache hit rate

Press `Esc` or `Enter` to return to the activity feed.

## Streaming modes

For piping into other tools or integrating with external systems, agenttop supports two non-TUI streaming modes:

### JSON mode

Stream events as JSONL (one JSON object per line):

```bash
agenttop --json | jq 'select(.type == "alert")'
agenttop --json --no-security   # tool calls and usage only
```

Event types: `sessions`, `tool_call`, `alert`, `usage`.

### Plain text mode

Stream events as human-readable lines:

```bash
agenttop --plain | grep ALERT
agenttop --plain > session.log
```

Output format:
```
SESSION cuddly-wiggling-sundae | opus | /home/matt | CPU 20% | 542MB | 1.2k in / 340 out
14:32:05 cuddly-wiggling-sundae Bash     ls /tmp/claude-0/
ALERT 14:32:10 [warn] cuddly-wiggling-sundae: curl to external URL
USAGE abc123 +100 in / +50 out
```

## Active protection

agenttop can install a Claude Code `PostToolUse` hook that blocks prompt injection attempts before they reach the model — it doesn't just detect, it prevents.

```bash
agenttop --install-hooks
```

Once installed, every tool result (Bash output, file contents, web fetches, grep results) is scanned for prompt injection patterns. If injection is detected, the tool result is blocked and the agent sees an error instead of the malicious content.

What it catches:

- **Instruction override** — "ignore previous instructions" and variants
- **Fake tags** — `<system>`, `[INST]`, `BEGIN HIDDEN INSTRUCTIONS`
- **Role reassignment** — "you are now...", "act as...", "pretend to be..."
- **Encoded payloads** — base64-encoded injection attempts, HTML entities
- **Exfiltration** — base64+curl, pipe-to-remote patterns in tool output

The hook is a standalone Python script with no dependencies. Remove it with `agenttop --uninstall-hooks`.

## Security rules

The TUI and streaming modes passively monitor all sessions for suspicious activity:

| Rule | Watches | Severity |
|------|---------|----------|
| **Network** | `curl`/`wget`/`nc` to external URLs | warn |
| **Exfiltration** | base64+curl, tar+upload, pipe to remote | high |
| **Sensitive files** | `.env`, `.ssh/*`, credentials, `/etc/shadow` | warn |
| **Shell escape** | `eval`, `chmod 777`, `sudo`, writes to `/etc/*` | high/critical |
| **Prompt injection** | Injection patterns in tool inputs and results | critical |

Individual rules can be disabled in the config file under `security.rules`.

Alerts are deduplicated within a 30-second window.

## MCP server

agenttop can run as an MCP server, letting Claude Code query session status, alerts, and usage directly:

```bash
agenttop --install-mcp   # register in Claude Code settings
agenttop --mcp           # start the MCP server (usually done automatically)
```

Available tools:

| Tool | Description |
|------|-------------|
| `agenttop_sessions` | List active sessions with model, CPU, MEM, tokens |
| `agenttop_alerts` | Get recent security alerts (filterable by severity) |
| `agenttop_usage` | Get token usage for a session or all sessions |
| `agenttop_activity` | Get recent tool calls for a session |

You can also run the MCP server directly via `agenttop-mcp` (installed as a separate bin).

## Notifications

When security alerts are raised:

- **Terminal bell** — `\x07` on high/critical alerts (configurable)
- **Desktop notification** — via `notify-send` (linux) or `osascript` (macOS) for critical alerts

Rate-limited to max 1 desktop notification per 30 seconds.

Configure in `config.json` under `notifications`, or disable entirely with `--no-notify`.

## Alert logging

Alerts are logged to `~/.config/agenttop/alerts.jsonl` by default. One JSON line per alert.

The log file rotates when it exceeds 10MB (keeps 2 rotated files).

Disable with `--no-alert-log` or set `alerts.enabled: false` in config.

## Auto-updates

On launch, agenttop checks npm for newer versions (5-second timeout, silent on failure). If a newer version is available, a banner appears in the status bar.

Press `u` to install the update in the background. Restart to apply.

Background re-checks every 6 hours while running.

Disable with `--no-updates` or set `updates.checkOnLaunch: false` in config.

## Configuration

Config file at `~/.config/agenttop/config.json` (respects `XDG_CONFIG_HOME`):

```json
{
  "pollInterval": 10000,
  "maxEvents": 200,
  "maxAlerts": 100,
  "alertLevel": "warn",
  "notifications": {
    "bell": true,
    "desktop": false,
    "minSeverity": "high"
  },
  "alerts": {
    "logFile": "~/.config/agenttop/alerts.jsonl",
    "enabled": true
  },
  "updates": {
    "checkOnLaunch": true,
    "checkInterval": 21600000
  },
  "keybindings": {
    "quit": "q",
    "navUp": "k",
    "navDown": "j",
    "panelNext": "tab",
    "panelPrev": "shift+tab",
    "scrollTop": "g",
    "scrollBottom": "G",
    "filter": "/",
    "nickname": "n",
    "clearNickname": "N",
    "detail": "enter",
    "update": "u"
  },
  "nicknames": {},
  "security": {
    "enabled": true,
    "rules": {
      "network": true,
      "exfiltration": true,
      "sensitiveFiles": true,
      "shellEscape": true,
      "injection": true
    }
  }
}
```

CLI flags override config values. Config is created with defaults on first run. New fields are auto-populated on upgrade.

## Keybindings

All keybindings are configurable via `keybindings` in the config file. The footer bar updates to reflect your custom bindings.

Default keybindings:

| Key | Action |
|-----|--------|
| `j` / `k` / arrows | Navigate sessions / scroll activity |
| `Tab` / left / right | Switch panel focus |
| `Enter` | Open session detail view |
| `Esc` | Close detail view / clear filter |
| `/` | Filter sessions |
| `n` | Set nickname for selected session |
| `N` | Clear nickname |
| `u` | Install available update |
| `g` / `G` | Scroll to top / bottom of activity |
| `q` | Quit |

## How it works

agenttop reads Claude Code's task output files from `/tmp/claude-<uid>/` using inotify-based file watching via [chokidar](https://github.com/paulmillr/chokidar). Each session writes JSONL events containing tool calls, tool results, and token usage, which agenttop parses and displays in real-time.

Three runtime dependencies: [ink](https://github.com/vadimdemedes/ink) (React-based TUI), chokidar (file watching), and [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) (MCP server). Everything else is Node built-ins.

## Multi-user support

- **Non-root** — monitors your own sessions only
- **Root** — use `--all-users` to monitor all users' sessions on the machine

## Contributing

This project is experimental and contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR guidelines.

Ideas for contributions:

- Support for additional agent platforms beyond Claude Code
- New security rules
- Themes and colour customisation
- Windows support

## Trademark notice

"Claude" is a trademark of Anthropic, PBC. This project is not affiliated with, endorsed by, or sponsored by Anthropic. It monitors Claude Code sessions by reading locally-stored session data.

## License

MIT
