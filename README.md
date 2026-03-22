# agenttop

Real-time terminal dashboard for monitoring AI coding agent sessions — like `htop` for agents.

Currently supports [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Reads local session data only — no network requests, no API keys.

## Table of contents

- [Install](#install)
- [Usage](#usage)
- [Active protection](#active-protection)
- [Security rules](#security-rules)
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
-- agenttop v1.0.0 ---- 3 sessions ---- 14:32:08 ---------------------
| SESSIONS                 | ACTIVITY (cuddly-wiggling-sundae)           |
|                          |                                             |
| > cuddly-wiggling-sundae | 14:32:05 Bash    ls /tmp/claude-0/         |
|   /home/matt | opus      | 14:32:03 Read    /root/.claude/CLAUDE.md   |
|   CPU 20% | 542MB | 3 ag | 14:31:58 Grep    pattern="sessionId"       |
|                          | 14:31:55 Write   /home/matt/app/src/...    |
|   jolly-dancing-pickle   | 14:31:52 Bash    npm test                  |
|   /home/matt/fleet | son |   * ALERT: curl to external URL             |
|                          |                                             |
|--------------------------|---------------------------------------------|
| ALERTS                                                                 |
| [!] 14:31:52 jolly-dancing-pickle: curl to unknown external URL        |
| [!] 14:31:40 cuddly-wiggling-sundae: Reading .env file                 |
|-- q:quit  j/k:nav  tab:panel ----------------------------------------|
```

### Options

```
agenttop [options]

  --all-users         Monitor all users (root only)
  --no-security       Disable security analysis
  --json              Stream events as JSON (no TUI, for piping)
  --alert-level <l>   Minimum: info|warn|high|critical (default: warn)
  --install-hooks     Install Claude Code hook for active injection protection
  --uninstall-hooks   Remove agenttop hooks from Claude Code
  --version           Show version
  --help              Show help
```

### Keyboard

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate sessions |
| `Tab` | Switch panel focus |
| `q` | Quit |

### JSON mode

Stream events as JSONL for piping into other tools:

```bash
agenttop --json | jq 'select(.type == "alert")'
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

The TUI and `--json` mode passively monitor all sessions for suspicious activity:

| Rule | Watches | Severity |
|------|---------|----------|
| **Network** | `curl`/`wget`/`nc` to external URLs | warn |
| **Exfiltration** | base64+curl, tar+upload, pipe to remote | high |
| **Sensitive files** | `.env`, `.ssh/*`, credentials, `/etc/shadow` | warn |
| **Shell escape** | `eval`, `chmod 777`, `sudo`, writes to `/etc/*` | high/critical |
| **Prompt injection** | Injection patterns in tool inputs and results | critical |

Tool results — the output that comes back to the agent — are scanned for injection attempts. This is where real-world prompt injection attacks occur: a malicious web page, a compromised file, or a crafted API response containing hidden instructions.

Alerts are deduplicated within a 30-second window.

## How it works

agenttop reads Claude Code's task output files from `/tmp/claude-<uid>/` using inotify-based file watching via [chokidar](https://github.com/paulmillr/chokidar). Each session writes JSONL events containing tool calls and tool results, which agenttop parses and displays in real-time.

Two runtime dependencies: [ink](https://github.com/vadimdemedes/ink) (React-based TUI) and chokidar (file watching). Everything else is Node built-ins.

## Multi-user support

- **Non-root** — monitors your own sessions only
- **Root** — use `--all-users` to monitor all users' sessions on the machine

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR guidelines.

## Trademark notice

"Claude" is a trademark of Anthropic, PBC. This project is not affiliated with, endorsed by, or sponsored by Anthropic. It monitors Claude Code sessions by reading locally-stored session data.

## License

MIT
