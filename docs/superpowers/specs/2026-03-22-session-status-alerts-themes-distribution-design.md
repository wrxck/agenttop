# Design: Session Status, Custom Alerts, Themes & Distribution

**Date:** 2026-03-22
**Status:** Draft

## Overview

Seven feature areas:

1. **Session status detection** — waiting-for-input and stale detection with UI indicators and sort priority
2. **Pinned sessions** — pin sessions to top with reordering, pin icon indicator
3. **Custom alerts with regex** — user-defined alert rules with TUI management
4. **Bootleg pop culture themes** — new creative themes with a disclaimer
5. **MCP server extensions** — new tools for status, alerts, pinning, and alert management
6. **Package manager distribution** — Homebrew, Winget, Scoop, AUR, Nix, Snap
7. **Documentation updates** — README and CONTRIBUTING updated for all new features

## 1. Session Status Detection

### Status Model

Replace the current binary PID-based status with a four-state model:

| Status | Condition | Indicator | Colour |
|--------|-----------|-----------|--------|
| `waiting` | Last event is assistant-only text (no `tool_use`) or `AskUserQuestion` tool call | `● [waiting]` | Yellow |
| `stale` | Active PID but output file unmodified for `staleTimeout` seconds | `● [stale]` | Orange |
| `active` | Active PID, recently active | `●` | Green |
| `inactive` | No PID | `○` | Grey |

### Detection Logic

During session discovery (both sync and async), after matching PID:

1. Read the last ~4KB of the output file using a new `readTailBytes(filePath, bytes)` utility (no existing utility reads from the end of file — `readFirstLines` only reads the head)
2. Parse the final JSONL event (last complete line)
3. If the event is `type: "assistant"`:
   - Check `message.content` array
   - If all blocks are `type: "text"` (no `tool_use`) → status = `waiting`
   - If any block is `tool_use` with `name: "AskUserQuestion"` → status = `waiting`
   - **Note:** `AskUserQuestion` is a Claude Code internal tool name — this is a known coupling point that may need updating if Claude Code renames it
4. If PID exists and `Date.now() - lastActivity > staleTimeout * 1000` → status = `stale`
   - `lastActivity` is derived from file `mtimeMs` (already read during discovery via `stat()`) and is refreshed each discovery cycle
5. If PID exists and neither above → status = `active`
6. If no PID → status = `inactive`

### New Utility

```typescript
// discovery/asyncHelpers.ts (or new file)
async function readTailBytes(filePath: string, bytes: number): Promise<string>
```

Opens file, seeks to `max(0, fileSize - bytes)`, reads to end, returns string. Used by both sync and async discovery paths.

### Sort Priority

```
pinned (user-defined order) > non-pinned waiting (by lastActivity desc) > non-pinned stale (by lastActivity desc) > non-pinned active (by lastActivity desc) > non-pinned inactive (by lastActivity desc)
```

Pinned sessions always appear at the top in their user-defined order, regardless of status. Within pinned sessions, the user controls the order via reordering keybindings. Non-pinned sessions sort by status priority (waiting=0, stale=1, active=2, inactive=3), then by lastActivity descending.

Exception: a pinned session that is `waiting` still shows the `[waiting]` indicator and yellow colour — the pin just controls position, not the status display.

Groups sort by the highest-priority status of any member (pinning is per-session, not per-group).

## 1b. Pinned Sessions

### Concept

Users can pin sessions to keep them visible at the top of the session list. Pinned sessions:
- Always appear above non-pinned sessions
- Maintain a user-defined order (reorderable)
- Show a pin icon (📌 or `*`) next to the status dot
- Persist across restarts via config

### Configuration

New field in `Config`:

```typescript
pinnedSessions: string[];  // ordered array of session IDs
```

Default: `[]` (empty array).

### Keybindings

| Key | Action |
|-----|--------|
| `p` | Toggle pin on selected session |
| `P` (shift+p) | Move pinned session up in pin order |
| `ctrl+p` | Move pinned session down in pin order |

New entries in `KeybindingsConfig`:

```typescript
pin: string;        // default: 'p'
pinMoveUp: string;  // default: 'P'
pinMoveDown: string; // default: (implementation decides — could be ctrl+p or another key)
```

### UI Indicators

In `SessionList.tsx`, pinned sessions display a pin marker before the status dot:

```
* ● my-session [waiting]
  ● other-session
```

The `*` (or similar compact marker) indicates pinned. The status dot and tags still display normally.

### Sort Implementation

The sort in `discoverSessions` and `discoverSessionsAsync` checks pinned status first:

```typescript
const pinnedOrder = config.pinnedSessions;

sessions.sort((a, b) => {
  const aPin = pinnedOrder.indexOf(a.sessionId);
  const bPin = pinnedOrder.indexOf(b.sessionId);
  const aIsPinned = aPin !== -1;
  const bIsPinned = bPin !== -1;

  // pinned before non-pinned
  if (aIsPinned && !bIsPinned) return -1;
  if (!aIsPinned && bIsPinned) return 1;

  // both pinned: user-defined order
  if (aIsPinned && bIsPinned) return aPin - bPin;

  // both non-pinned: status priority, then lastActivity
  const aPri = STATUS_PRIORITY[a.status];
  const bPri = STATUS_PRIORITY[b.status];
  if (aPri !== bPri) return aPri - bPri;
  return b.lastActivity - a.lastActivity;
});
```

### MCP Extensions

- `agenttop_pin_session` — pin a session (adds to end of pinned list)
- `agenttop_unpin_session` — unpin a session
- `agenttop_sessions` — response now includes `pinned: boolean` field

### Type Changes

```typescript
// discovery/types.ts
type SessionStatus = 'waiting' | 'stale' | 'active' | 'inactive';

interface Session {
  // ... existing fields ...
  status: SessionStatus; // new field, replaces pid-based checks in UI
}

interface SessionGroup {
  // ... existing fields ...
  status: SessionStatus; // replaces isActive: boolean — aggregate of member statuses
}
```

`SessionGroup.isActive` is removed and replaced with `SessionGroup.status`, which is the highest-priority status among all members. All rendering code in `SessionList.tsx` that checks `g.isActive` must be updated to use `g.status`.

### Theme Colour Slots

Add `waiting` and `stale` colour slots to the `ThemeColors` interface in `src/config/themes.ts`:

```typescript
interface ThemeColors {
  // ... existing fields ...
  waiting: string;  // yellow — for waiting-for-input indicator
  stale: string;    // orange — for stale/idle indicator
}
```

All existing themes (15) and new themes (12) must define these two colours. Ensure `waiting` and `stale` are visually distinguishable from `success` (green) and `error` (red) in every theme.

### Configuration

New fields added to the existing `AlertsConfig` interface in `src/config/store.ts`:

```typescript
export interface AlertsConfig {
  logFile: string;       // existing
  enabled: boolean;      // existing
  staleTimeout: number;  // new — seconds before active session is considered stale (default: 60)
  staleAlertSeverity: AlertSeverity; // new — severity of stale alerts (default: 'warn')
  custom: CustomAlertRule[];         // new — user-defined regex rules
}
```

This extends the existing interface rather than creating a new config key, avoiding collision with the existing `alerts` config structure. The `deepMerge` function in `store.ts` will merge new defaults seamlessly.

Config JSON example:

```json
{
  "alerts": {
    "logFile": "~/.config/agenttop/alerts.jsonl",
    "enabled": true,
    "staleTimeout": 60,
    "staleAlertSeverity": "warn",
    "custom": []
  }
}
```

Default stale timeout: 60 seconds. Adjustable via TUI settings (+/- in 15s increments).

### Performance

Reading tail ~4KB per session adds ~1-2ms per session during discovery cycle (10-30s interval). Negligible overhead. The MCP server uses sync discovery — the added I/O per session is acceptable.

## 2. Custom Alerts with Regex

### Config Schema

See `AlertsConfig.custom` in section 1 above. Each custom rule:

```json
{
  "name": "dangerous-rm",
  "pattern": "rm\\s+-rf\\s+/",
  "match": "input",
  "severity": "high",
  "message": "Dangerous recursive delete detected"
}
```

Fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | — | Unique identifier |
| `pattern` | string | yes | — | Regex pattern |
| `match` | `input \| output \| toolName \| all` | no | `all` | What to match against |
| `severity` | `info \| warn \| high \| critical` | no | `warn` | Alert severity |
| `message` | string | no | name | Custom alert message |

### Implementation

The existing security engine has two rule types:
- `ToolCallRule = (call: ToolCall) => Alert | null` — for network, exfiltration, sensitiveFiles, shellEscape
- `SecurityEventRule = (event: SecurityEvent) => Alert | null` — for injection

Custom rules are registered as `SecurityEventRule` instances in the `allEventRules` array, since `SecurityEvent` is a union of `ToolCall | ToolResult` and provides access to both tool input and tool output. The match target determines which fields the regex is tested against:

- `match: "input"` — only checks when event is a ToolCall, tests `JSON.stringify(toolInput)`
- `match: "output"` — only checks when event is a ToolResult, tests result content string
- `match: "toolName"` — checks ToolCall events only, tests tool name
- `match: "all"` — checks all applicable fields for the event type, first match wins

New file: `src/analysis/rules/custom.ts`
- Exports a factory function: `createCustomRules(config: CustomAlertRule[]): SecurityEventRule[]`
- On startup and config change, compile regex patterns with `new RegExp(pattern)`
- Invalid patterns logged as warnings and skipped (don't crash)
- Plugs into existing `SecurityEngine.analyze()` pipeline
- Same deduplication (30-second window, `DEDUP_WINDOW_MS` in `security.ts`) as built-in rules

### TUI Management

New keybinding `alertRules: 'r'` added to `KeybindingsConfig` in `src/config/store.ts`. Opens a modal Alert Rules screen (similar to SettingsMenu/ThemeMenu).

All keybindings within the Alert Rules screen (`n`, `e`, `d`, `space`, `+`, `-`) are scoped to the modal — they do not conflict with the global keybindings for `nickname`, `delete`, etc. The modal intercepts all key events while open and only passes `Esc` through to close itself.

```
-- Alert Rules -----------------------------------------------
|                                                             |
|  Built-in Rules                                             |
|  ● network            [warn]     enabled                    |
|  ● exfiltration        [critical]  enabled                  |
|  ● sensitive-files     [warn]     enabled                   |
|  ● shell-escape        [high]     disabled                  |
|  ● injection           [critical]  enabled                  |
|                                                             |
|  Custom Rules                                               |
|  ● dangerous-rm        [high]     rm\s+-rf\s+/              |
|  ● secret-leak         [critical]  (API|SECRET)_KEY         |
|                                                             |
|  Stale Timeout: 60s    Severity: warn                       |
|                                                             |
|  [n] New  [e] Edit  [d] Delete  [space] Toggle              |
|  [+/-] Stale timeout  [Esc] Back                            |
--------------------------------------------------------------
```

Interactions:
- Arrow keys to navigate rules
- `space` to enable/disable any rule (built-in or custom)
- `n` opens inline form: name -> pattern (regex validated) -> match target -> severity -> message
- `e` edits selected custom rule (same form, pre-filled)
- `d` deletes selected custom rule (with confirmation)
- `+`/`-` adjusts stale timeout in 15s increments
- Changes persist to config immediately
- `Esc` returns to main view
- Invalid regex shows inline error, doesn't save

## 3. Themes

### New Bootleg Pop Culture Themes

Added on top of the existing 15 built-in themes:

| Theme Name | Inspiration | Palette |
|------------|-------------|---------|
| Hi Feline | Hello Kitty | Pastel pinks, reds, white, bow accents |
| Plumber Bros | Mario | Red, green, blue, gold |
| Hedgehog Speed | Sonic | Cobalt blue, gold, green hills |
| Block Craft | Minecraft | Earthy browns, greens, creeper green accents |
| Galaxy Conflicts | Star Wars | Dark red/black vs light blue/white |
| Pocket Creatures | Pokemon | Red/white, electric yellow accents |
| Brick Wizard | Harry Potter | Deep purples, golds, house colours |
| Caped Knight | Batman | Dark greys, blacks, yellow utility accents |
| Web Crawler | Spider-Man | Red/blue, web-white accents |
| Frozen Kingdom | Frozen | Icy blues, purples, snowflake whites |
| Coral Reef | Finding Nemo | Oranges, blues, anemone purples |
| Toy Ranch | Toy Story | Woody browns, Buzz greens/purples, cloud white |

All new themes must define `waiting` and `stale` colour slots in addition to existing slots.

### Disclaimer

At the bottom of the theme menu screen, rendered in dim/muted text below the theme list. Reserve 2 lines of vertical space at the bottom of the component (before the border) for the disclaimer text:

> "Some themes were inspired by pop culture. Names have been changed to protect the innocent (and our legal team)."

## 4. MCP Server Extensions

### New Tools

| Tool | Description |
|------|-------------|
| `agenttop_waiting_sessions` | List sessions in `waiting` or `stale` state with time in that state |
| `agenttop_custom_alerts` | List configured custom alert rules |
| `agenttop_set_custom_alert` | Add or update a custom alert rule |
| `agenttop_delete_custom_alert` | Remove a custom alert rule by name |
| `agenttop_alert_history` | Recent alerts (built-in + custom), filterable by severity |
| `agenttop_set_stale_timeout` | Update the stale threshold |
| `agenttop_session_status` | Full status for a session (`waiting \| stale \| active \| inactive`) |

### Extended Existing Tools

- `agenttop_sessions` — response now includes `status` field per session
- `agenttop_alerts` — response now includes custom rule matches

### Input Schemas

**agenttop_waiting_sessions**: no required input

**agenttop_set_custom_alert**:
```json
{
  "name": "string (required)",
  "pattern": "string (required, regex)",
  "match": "input | output | toolName | all (optional, default: all)",
  "severity": "info | warn | high | critical (optional, default: warn)",
  "message": "string (optional)"
}
```

**agenttop_delete_custom_alert**:
```json
{
  "name": "string (required)"
}
```

**agenttop_alert_history**:
```json
{
  "severity": "info | warn | high | critical (optional, filter)",
  "limit": "number (optional, default: 50)"
}
```

**agenttop_set_stale_timeout**:
```json
{
  "seconds": "number (required, minimum: 15)"
}
```

**agenttop_session_status**:
```json
{
  "sessionId": "string (required)"
}
```

## 5. Package Manager Distribution

### Homebrew (macOS / Linux)

- **Already partially set up** — README references `brew tap wrxck/tap` but tap repo may not exist yet
- Create `wrxck/homebrew-tap` repo with formula
- Formula installs via `npm install -g agenttop` (node formula dependency)
- CI: GitHub Action on release triggers formula version bump via PR to tap repo

### Scoop (Windows)

- Create `wrxck/scoop-bucket` repo
- JSON manifest pointing to npm package
- CI: auto-update manifest on release

### Winget (Windows)

- Submit manifest PR to `microsoft/winget-pkgs`
- Bundle standalone exe using `pkg` (Node + agenttop -> single binary)
- Wrap in `.zip` for winget distribution
- CI: build exe on release, submit PR to winget-pkgs repo

### AUR (Arch Linux)

- Create `agenttop` PKGBUILD
- Declares `nodejs` and `npm` as dependencies
- Installs via `npm install -g agenttop`
- Publish to AUR
- CI: update PKGBUILD `pkgver` on release

### Nix (NixOS / any)

- Add `flake.nix` to repo root using `buildNpmPackage`
- Users can run `nix run github:wrxck/agenttop`
- Optionally submit to nixpkgs for `nix-env -i agenttop`

### Snap (Ubuntu / Linux)

- Add `snap/snapcraft.yaml` to repo
- Use `node` plugin with `classic` confinement (agenttop reads from `~/.claude/`, `/tmp/`, and other user directories — `strict` confinement would require extensive plug declarations)
- Publish to Snap Store as `agenttop`
- CI: `snapcraft` build + upload on release

### CI Workflow

New GitHub Actions workflow `.github/workflows/publish.yml`:
- Triggered on GitHub release (tag push)
- Matrix job for each package manager
- Auto-submits PRs / updates to external repos (winget-pkgs, AUR)
- Builds standalone exe for winget

## 6. Documentation Updates

### README.md

- **Install section** — add Scoop, Winget, AUR, Nix, Snap alongside existing npm and Homebrew
- **New section: Session status** — document waiting/stale detection, indicators, sort behaviour
- **New section: Custom alerts** — document config schema, TUI management, regex syntax
- **Themes section** — update count, mention bootleg pop culture themes
- **MCP server section** — add new tools to the table
- **Configuration section** — add `alerts.staleTimeout`, `alerts.staleAlertSeverity`, `alerts.custom` to example config
- **Keybindings section** — add `r` for alert rules
- **Table of contents** — updated

### CONTRIBUTING.md

- **Dependencies** — fix "Two runtime deps" to "Four runtime deps" (ink, react, chokidar, @modelcontextprotocol/sdk)
- **Architecture** — add `config/store.ts`, `config/themes.ts`, `mcp/server.ts` to tree
- **Adding security rules** — mention custom rules as an alternative to code changes
- **Adding themes** — new section documenting how to add built-in themes in `themes.ts`

## 7. Testing

### Test Coverage Required

- **Status detection** — unit tests for `readTailBytes` utility, status determination from mock JSONL events (text-only assistant, AskUserQuestion tool_use, tool_use, no PID)
- **Stale detection** — unit tests with mocked timestamps for stale timeout logic
- **Custom rules** — unit tests for regex compilation, pattern matching against input/output/toolName/all, invalid regex handling, config loading
- **Sort priority** — unit tests for the four-state sort ordering
- **Config migration** — verify `deepMerge` correctly populates new `AlertsConfig` fields from defaults
- **MCP tools** — integration tests for new MCP tool handlers

## Files to Create or Modify

### New Files
- `src/analysis/rules/custom.ts` — custom alert rule engine
- `src/ui/components/AlertRulesMenu.tsx` — TUI management screen
- `snap/snapcraft.yaml` — Snap packaging
- `flake.nix` — Nix flake
- `.github/workflows/publish.yml` — multi-platform publish CI
- Separate repos: `wrxck/homebrew-tap`, `wrxck/scoop-bucket`

### Modified Files
- `src/discovery/types.ts` — add `SessionStatus` type, `status` field on `Session`, update `SessionGroup`
- `src/discovery/sessions.ts` — status detection logic, new sort, `readTailBytes` utility
- `src/discovery/sessionsAsync.ts` — status detection logic, new sort
- `src/discovery/asyncHelpers.ts` — `readTailBytes` utility function
- `src/ui/components/SessionList.tsx` — status indicators, sort priority, colours, replace `isActive` usage
- `src/config/themes.ts` — new theme definitions (bootleg pop culture), `waiting`/`stale` colour slots on `ThemeColors`
- `src/ui/components/ThemeMenu.tsx` — disclaimer text with reserved space
- `src/analysis/security.ts` — load custom rules from config, register as `SecurityEventRule`
- `src/config/store.ts` — extend `AlertsConfig`, add `alertRules` keybinding to `KeybindingsConfig`
- `src/mcp/server.ts` — new MCP tools
- `src/ui/App.tsx` — keybinding for alert rules menu, modal state
- `src/ui/hooks/useKeyHandler.ts` — `r` keybinding
- `src/stream.ts` — status field in streaming output
- `README.md` — all documentation updates
- `CONTRIBUTING.md` — architecture, dependency count, custom rules docs, theme docs
- `package.json` — new scripts for packaging
