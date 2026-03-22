# agenttop

[![npm version](https://img.shields.io/npm/v/agenttop.svg)](https://www.npmjs.com/package/agenttop)
[![npm downloads](https://img.shields.io/npm/dm/agenttop.svg)](https://www.npmjs.com/package/agenttop)
[![CI](https://github.com/wrxck/agenttop/actions/workflows/ci.yml/badge.svg)](https://github.com/wrxck/agenttop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/agenttop.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg)](#platform-support)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/wrxck/agenttop/pulls)
[![GitHub code size](https://img.shields.io/github/languages/code-size/wrxck/agenttop)](https://github.com/wrxck/agenttop)

Real-time terminal dashboard for monitoring AI coding agent sessions — like `htop` for agents.

Currently supports [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Reads local session data only — no network requests, no API keys.

Read more about [why agenttop was built](https://blog.matthesketh.pro/blog/agenttop).

> **Experimental** — this project is under active development. APIs and configuration may change between releases. Feature requests, bug reports, and contributions are very welcome. See [Contributing](#contributing).

## Table of contents

- [Install](#install)
- [Platform support](#platform-support)
- [Usage](#usage)
- [Token usage](#token-usage)
- [Session nicknames](#session-nicknames)
- [Session filtering](#session-filtering)
- [Session management](#session-management)
- [Session detail view](#session-detail-view)
- [Split view](#split-view)
- [Themes](#themes)
- [Streaming modes](#streaming-modes)
- [Active protection](#active-protection)
- [Session status](#session-status)
- [Pinned sessions](#pinned-sessions)
- [Security rules](#security-rules)
- [Custom alerts](#custom-alerts)
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

### npm (all platforms)

```bash
npx agenttop
```

Or install globally:

```bash
npm install -g agenttop
```

### Homebrew (macOS / Linux)

```bash
brew tap wrxck/tap
brew install agenttop
```

### Scoop (Windows)

```powershell
scoop bucket add wrxck https://github.com/wrxck/scoop-bucket
scoop install agenttop
```

### Winget (Windows)

```powershell
winget install wrxck.agenttop
```

### AUR (Arch Linux)

```bash
yay -S agenttop
```

### Nix

```bash
nix run github:wrxck/agenttop
```

### Snap

```bash
sudo snap install agenttop --classic
```

## Platform support

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux** (Ubuntu, Debian, Fedora, Arch, etc.) | Fully supported | Primary development platform |
| **macOS** (Intel + Apple Silicon) | Fully supported | Uses `lsof` for process CWD resolution |
| **Windows** (10/11 + Windows Terminal) | Supported | Uses PowerShell for process discovery; `--all-users` not available |

Development and primary testing is done on Ubuntu. If you encounter issues on other platforms, please [open an issue](https://github.com/wrxck/agenttop/issues) or feel free to contribute a fix.

CI runs on all three platforms (Ubuntu, macOS, Windows) across Node.js 18, 20, and 22.

### Platform-specific config paths

| Platform | Config path |
|----------|-------------|
| Linux | `~/.config/agenttop/config.json` (respects `XDG_CONFIG_HOME`) |
| macOS | `~/.config/agenttop/config.json` (respects `XDG_CONFIG_HOME`) |
| Windows | `%APPDATA%\agenttop\config.json` |

## Usage

Run `agenttop` in one terminal while running Claude Code sessions in other tabs.

```
-- agenttop v0.10.7 --- 3 sessions ---- 14:32:08 ---------------------
| SESSIONS                 | ACTIVITY (cuddly-wiggling-sundae)           |
|                          |                                             |
| > cuddly-wiggling-sundae | 14:32:05 Bash    ls -la                    |
|   /home/matt | opus      | 14:32:03 Read    CLAUDE.md                 |
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

  --all-users          Monitor all users (root only, Linux/macOS)
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

Nicknames are stored in your [config file](#configuration).

## Session filtering

Press `/` to open the filter input. The filter applies to whichever panel is focused:

- **Sessions panel** — filters by slug, nickname, project, or model
- **Activity panel** — filters by tool name or tool input content

Case-insensitive substring match. Press `Esc` to clear the filter.

## Session management

### Archive

Press `a` to archive a session. Archived sessions are hidden from the main view but not deleted.

Press `A` to toggle the archive view, which shows only archived sessions. In the archive view, press `a` to restore a session back to the main view.

Archive expiry can be configured in settings (`s`) under GENERAL — options are never, 7d, 14d, 30d, 60d, or 90d. Expired archives are purged on launch.

### Delete

Press `d` to delete a session. A confirmation prompt appears. On confirm, the session's output files are removed from disk and any nickname or archive entry is cleared.

### Active/inactive indicators

Sessions with a running process are shown in green. Inactive sessions (no process) are shown in red.

## Session status

agenttop detects four session states:

| Status | Indicator | Meaning |
|--------|-----------|---------|
| Waiting | Yellow ● `[waiting]` | Claude has asked a question and is waiting for your input |
| Stale | Orange ● `[stale]` | Process is running but no output for the configured timeout |
| Active | Green ● | Actively processing |
| Inactive | Grey ○ | Process has ended |

Sessions sort by status priority: waiting > stale > active > inactive, then by last activity within each group.

The stale timeout (default 60s) can be adjusted in the Alert Rules menu (`r`).

## Pinned sessions

Press `p` to pin a session to the top of the list. Pinned sessions always appear above non-pinned sessions, regardless of status.

- `p` — toggle pin on selected session
- `P` — move pinned session up in pin order

Pinned sessions show a `*` marker next to the status dot. Pin order persists across restarts.

## Session detail view

Press `Enter` on a session to open the detail view, which shows:

- Slug, nickname, model, cwd, git branch, version, PID
- CPU, memory, uptime, agent count
- Full token usage breakdown with cache hit rate

Press `Esc` or `Enter` to return to the activity feed.

## Split view

Press `x` to toggle split-screen mode. The right area splits into two independent activity panels, each pinned to a different session with its own scroll position and filter.

When split mode is active:

- **Pin sessions** — navigate to a session in the sidebar and press `1` to pin it to the left panel, or `2` for the right panel
- **Navigate panels** — use `Tab` or left/right arrows to move focus between sidebar, left panel, and right panel
- **Independent filtering** — press `/` to filter whichever panel is focused
- **Swap panels** — press `S` to swap the left and right panels (sessions, scroll, filters)
- **Close a panel** — press `X` to clear the focused panel's session. If both panels are empty, split mode exits automatically
- **Detail view** — press `Enter` on a split panel to toggle the detail view for that panel

Press `x` again to exit split mode and return to the single-panel layout.

## Themes

agenttop ships with 27 built-in colour themes and a full theme management system. Open Settings (`s`) and select **Manage themes...** to access the theme menu.

Built-in themes: One Dark (default), Dracula, Monokai Pro, Solarized Dark, Solarized Light, Nord, Gruvbox Dark, Tokyo Night, Catppuccin Mocha, Catppuccin Latte, Rose Pine, Rose Pine Moon, Pastel Dark, Kanagawa, Everforest, Hi Feline, Plumber Bros, Hedgehog Speed, Block Craft, Galaxy Conflicts, Pocket Creatures, Brick Wizard, Caped Knight, Web Crawler, Frozen Kingdom, Coral Reef, and Toy Ranch.

In the theme menu:

- **Browse and preview** — navigate with up/down arrows. Each theme previews live as you select it
- **Apply** — press `Enter` to set the selected theme as active
- **Copy** — press `c` to create a custom theme based on the selected one
- **Edit** — press `e` to edit a custom theme's colours (individual hex values)
- **Rename** — press `r` to rename a custom theme
- **Delete** — press `d` to delete a custom theme
- **Restore default** — press `Backspace` to reset to One Dark

Custom themes are saved to your [config file](#configuration) and persist across sessions.

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
14:32:05 cuddly-wiggling-sundae Bash     ls -la
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

## Custom alerts

Define custom alert rules with regex patterns to match against tool activity.

Press `r` to open the Alert Rules menu where you can:

- Toggle built-in security rules on/off
- Add custom rules with regex patterns
- Choose what to match: tool input, output, tool name, or all
- Set severity level per rule
- Adjust the stale session timeout

Custom rules can also be defined in your config file:

```json
{
  "alerts": {
    "staleTimeout": 60,
    "custom": [
      {
        "name": "dangerous-rm",
        "pattern": "rm\\s+-rf\\s+/",
        "match": "input",
        "severity": "high",
        "message": "Dangerous recursive delete detected",
        "enabled": true
      }
    ]
  }
}
```

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
| `agenttop_waiting_sessions` | List sessions in waiting or stale state |
| `agenttop_session_status` | Get status for a specific session |
| `agenttop_custom_alerts` | List configured custom alert rules |
| `agenttop_set_custom_alert` | Add or update a custom alert rule |
| `agenttop_delete_custom_alert` | Delete a custom alert rule |
| `agenttop_alert_history` | Get recent alerts with severity filter |
| `agenttop_set_stale_timeout` | Set the stale timeout |
| `agenttop_pin_session` | Pin a session to the top |
| `agenttop_unpin_session` | Unpin a session |

You can also run the MCP server directly via `agenttop-mcp` (installed as a separate bin).

## Notifications

When security alerts are raised:

- **Terminal bell** — `\x07` on high/critical alerts (configurable)
- **Desktop notification** — via `notify-send` (Linux), `osascript` (macOS), or PowerShell toast (Windows)

Rate-limited to max 1 desktop notification per 30 seconds.

Configure in your [config file](#configuration) under `notifications`, or disable entirely with `--no-notify`.

## Alert logging

Alerts are logged to `alerts.jsonl` in your [config directory](#platform-specific-config-paths) by default. One JSON line per alert.

The log file rotates when it exceeds 10MB (keeps 2 rotated files).

Disable with `--no-alert-log` or set `alerts.enabled: false` in config.

## Auto-updates

On launch, agenttop checks npm for newer versions (5-second timeout, silent on failure). If a newer version is available, a banner appears in the status bar.

Press `u` to install the update in the background. Restart to apply.

Background re-checks every 6 hours while running.

Disable with `--no-updates` or set `updates.checkOnLaunch: false` in config.

## Configuration

Config file location depends on your platform — see [platform-specific config paths](#platform-specific-config-paths).

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
    "enabled": true,
    "staleTimeout": 60,
    "custom": []
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
    "update": "u",
    "settings": "s",
    "archive": "a",
    "delete": "d",
    "viewArchive": "A",
    "split": "x",
    "pinLeft": "1",
    "pinRight": "2",
    "swapPanels": "S",
    "closePanel": "X",
    "alertRules": "r",
    "pin": "p",
    "pinUp": "P"
  },
  "theme": "one-dark",
  "customThemes": {},
  "nicknames": {},
  "archived": {},
  "archiveExpiryDays": 0,
  "pinnedSessions": [],
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

All keybindings are configurable via Settings (`s`). The footer bar updates to reflect your custom bindings.

When rebinding a key, duplicate assignments are rejected with a toast notification — change the conflicting binding first. Press `Backspace` during rebind to reset a single key to its default, or use **Reset all keybindings** at the bottom of the keybindings section.

Default keybindings:

| Key | Action |
|-----|--------|
| `j` / `k` / arrows | Navigate sessions / scroll activity |
| `Tab` / left / right | Switch panel focus |
| `Enter` | Open session detail view |
| `Esc` | Close detail view / clear filter |
| `/` | Filter active panel (sessions or activity) |
| `n` | Set nickname for selected session |
| `N` | Clear nickname |
| `a` | Archive session (restore in archive view) |
| `d` | Delete session (with confirmation) |
| `A` | Toggle archive view |
| `s` | Open settings |
| `u` | Install available update |
| `g` / `G` | Scroll to top / bottom of activity |
| `x` | Toggle split view |
| `1` / `2` | Pin session to left / right panel (split mode) |
| `S` | Swap left and right panels (split mode) |
| `X` | Close focused panel (split mode) |
| `r` | Open alert rules menu |
| `p` | Toggle pin on selected session |
| `P` | Move pinned session up |
| `q` | Quit |

## How it works

agenttop reads Claude Code's session output files using cross-platform file watching via [chokidar](https://github.com/paulmillr/chokidar) (inotify on Linux, FSEvents on macOS, ReadDirectoryChangesW on Windows). Each session writes JSONL events containing tool calls, tool results, and token usage, which agenttop parses and displays in real-time.

Four runtime dependencies: [ink](https://github.com/vadimdemedes/ink) and [react](https://react.dev/) (React-based TUI), [chokidar](https://github.com/paulmillr/chokidar) (file watching), and [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) (MCP server). Everything else is Node built-ins.

## Multi-user support

- **Non-root** — monitors your own sessions only
- **Root** — use `--all-users` to monitor all users' sessions on the machine (Linux/macOS only)

## Contributing

This project is experimental and contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR guidelines.

Ideas for contributions:

- Support for additional agent platforms beyond Claude Code
- New security rules
- Platform-specific improvements

## Trademark notice

"Claude" is a trademark of Anthropic, PBC. This project is not affiliated with, endorsed by, or sponsored by Anthropic. It monitors Claude Code sessions by reading locally-stored session data.

## License

MIT
