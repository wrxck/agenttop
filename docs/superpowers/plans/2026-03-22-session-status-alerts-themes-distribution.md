# Session Status, Custom Alerts, Themes & Distribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add waiting/stale session detection, custom regex alert rules with TUI management, bootleg pop culture themes, MCP extensions, six package manager distributions, and documentation updates.

**Architecture:** Extend the existing session discovery pipeline to derive a four-state status from the tail of output files. Add a custom rule engine that loads user-defined regex patterns into the existing SecurityEngine pipeline. New themes are added as PresetTuples in themes.ts. MCP server gets new tool handlers. Package distribution uses CI workflows and external repos.

**Tech Stack:** TypeScript, React/Ink, Node.js fs APIs, @modelcontextprotocol/sdk, GitHub Actions, Homebrew, Scoop, Winget, AUR, Nix, Snap

**Spec:** `docs/superpowers/specs/2026-03-22-session-status-alerts-themes-distribution-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/analysis/rules/custom.ts` | Custom regex alert rule engine — compiles user-defined patterns, matches against SecurityEvents |
| `src/ui/components/AlertRulesMenu.tsx` | TUI modal for managing alert rules (add/edit/delete custom rules, toggle built-in rules, adjust stale timeout) |
| `tests/custom-rules.test.ts` | Tests for custom regex rules |
| `tests/session-status.test.ts` | Tests for status detection and sorting |
| `snap/snapcraft.yaml` | Snap packaging config |
| `flake.nix` | Nix flake for `nix run` |
| `.github/workflows/publish.yml` | CI workflow for multi-platform package publishing |

### Modified Files
| File | Changes |
|------|---------|
| `src/discovery/types.ts` | Add `SessionStatus` type, `status` field on `Session`, replace `isActive` with `status` on `SessionGroup` |
| `src/discovery/sessions.ts` | Add `readTailBytes()`, `detectStatus()`, update sort logic |
| `src/discovery/sessionsAsync.ts` | Add async `readTailBytesAsync()`, `detectStatusAsync()`, update sort logic |
| `src/config/store.ts` | Extend `AlertsConfig` with `staleTimeout`, `staleAlertSeverity`, `custom[]`; add `alertRules`/`pin`/`pinMoveUp`/`pinMoveDown` keybindings; add `pinnedSessions` to Config |
| `src/config/themes.ts` | Add `waiting`/`stale` to `ThemeColors`, update `PresetTuple`, `fromTuple`, `COLOR_KEYS`; add 12 bootleg themes |
| `src/analysis/security.ts` | Accept custom rules in constructor, register as `SecurityEventRule`s |
| `src/ui/components/SessionList.tsx` | Use `session.status` for indicators/colours instead of `pid !== null` |
| `src/ui/components/ThemeMenu.tsx` | Add disclaimer text at bottom |
| `src/ui/App.tsx` | Add `showAlertRules` state, wire `r` keybinding, render `AlertRulesMenu` |
| `src/ui/hooks/useKeyHandler.ts` | Add `alertRules` key check, block input when `showAlertRules` |
| `src/ui/theme.ts` | Add `waiting`/`stale` to `colors` object |
| `src/mcp/server.ts` | Add 7 new MCP tools, extend `agenttop_sessions` with status |
| `src/stream.ts` | Add `status` field to session output |
| `README.md` | New install methods, session status, custom alerts, themes, MCP tools |
| `CONTRIBUTING.md` | Fix dep count, update architecture tree |

---

## Task 1: Types — SessionStatus and Session.status

**Files:**
- Modify: `src/discovery/types.ts:8-27` (Session interface)
- Modify: `src/discovery/types.ts:97-108` (SessionGroup interface)

- [ ] **Step 1: Add SessionStatus type and update Session**

Add after the `TokenUsage` interface (line 6), before `Session`:

```typescript
export type SessionStatus = 'waiting' | 'stale' | 'active' | 'inactive';

export const STATUS_PRIORITY: Record<SessionStatus, number> = {
  waiting: 0,
  stale: 1,
  active: 2,
  inactive: 3,
};
```

Add `status: SessionStatus;` to the `Session` interface after `nickname`:

```typescript
export interface Session {
  // ... existing fields ...
  nickname?: string;
  status: SessionStatus;
}
```

- [ ] **Step 2: Update SessionGroup — replace isActive with status**

```typescript
export interface SessionGroup {
  key: string;
  sessions: Session[];
  expanded: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  latestModel: string;
  status: SessionStatus;  // replaces isActive: boolean
  latestActivity: number;
  earliestStart: number;
}
```

- [ ] **Step 3: Build to check for compile errors**

Run: `npm run build 2>&1 | head -60`
Expected: Compile errors in files that reference `isActive` or construct Session objects without `status`. This is expected — we'll fix them in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/discovery/types.ts
git commit -m "feat(types): add SessionStatus type and status field to Session and SessionGroup"
```

---

## Task 2: Config — Extend AlertsConfig and KeybindingsConfig

**Files:**
- Modify: `src/config/store.ts:21-24` (AlertsConfig)
- Modify: `src/config/store.ts:39-63` (KeybindingsConfig)
- Modify: `src/config/store.ts:96-162` (defaultConfig)

- [ ] **Step 1: Add CustomAlertRule interface and extend AlertsConfig**

After the existing `AlertsConfig` interface (line 21), add:

```typescript
export interface CustomAlertRule {
  name: string;
  pattern: string;
  match: 'input' | 'output' | 'toolName' | 'all';
  severity: 'info' | 'warn' | 'high' | 'critical';
  message: string;
  enabled: boolean;
}

export interface AlertsConfig {
  logFile: string;
  enabled: boolean;
  staleTimeout: number;
  staleAlertSeverity: 'info' | 'warn' | 'high' | 'critical';
  custom: CustomAlertRule[];
}
```

- [ ] **Step 2: Add alertRules keybinding**

Add to `KeybindingsConfig`:

```typescript
alertRules: string;
```

- [ ] **Step 3: Update defaultConfig**

Update the `alerts` section in `defaultConfig()`:

```typescript
alerts: {
  logFile: join(getConfigDir(), 'alerts.jsonl'),
  enabled: true,
  staleTimeout: 60,
  staleAlertSeverity: 'warn',
  custom: [],
},
```

Add to keybindings defaults:

```typescript
alertRules: 'r',
```

- [ ] **Step 4: Build to verify**

Run: `npm run build 2>&1 | head -30`
Expected: May still have errors from Task 1 changes. Config changes themselves should compile.

- [ ] **Step 5: Commit**

```bash
git add src/config/store.ts
git commit -m "feat(config): extend AlertsConfig with stale timeout and custom rules, add alertRules keybinding"
```

---

## Task 3: Theme Colours — Add waiting/stale slots

**Files:**
- Modify: `src/config/themes.ts:1-14` (ThemeColors)
- Modify: `src/config/themes.ts:35-48` (COLOR_KEYS)
- Modify: `src/config/themes.ts:74-124` (PresetTuple, fromTuple)
- Modify: `src/config/themes.ts:126-352` (PRESETS)
- Modify: `src/ui/theme.ts`

- [ ] **Step 1: Add waiting and stale to ThemeColors**

```typescript
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  error: string;
  critical: string;
  muted: string;
  text: string;
  bright: string;
  border: string;
  selected: string;
  header: string;
  waiting: string;   // yellow — waiting for user input
  stale: string;     // orange — idle/stale session
}
```

- [ ] **Step 2: Update COLOR_KEYS**

```typescript
export const COLOR_KEYS: (keyof ThemeColors)[] = [
  'primary', 'secondary', 'accent', 'warning', 'error', 'critical',
  'muted', 'text', 'bright', 'border', 'selected', 'header',
  'waiting', 'stale',
];
```

- [ ] **Step 3: Update PresetTuple and fromTuple**

Extend `PresetTuple` to 15 elements (add waiting, stale at the end):

```typescript
type PresetTuple = [
  string, string, string, string, string, string, string,
  string, string, string, string, string, string,
  string, string,  // waiting, stale
];
```

Update `fromTuple` to destructure all 15 elements:

```typescript
const fromTuple = ([
  name, primary, secondary, accent, warning, error, critical,
  muted, text, bright, border, selected, header,
  waiting, stale,
]: PresetTuple): ThemeDefinition => ({
  name,
  builtin: true,
  colors: { primary, secondary, accent, warning, error, critical, muted, text, bright, border, selected, header, waiting, stale },
  toolColors: deriveToolColors({
    primary, secondary, accent, warning, error, critical, muted, text, bright, border, selected, header, waiting, stale,
  }),
});
```

- [ ] **Step 4: Add waiting and stale values to all 15 existing presets**

Each preset tuple gains 2 new values at the end. Use theme-appropriate yellows and oranges. For example:

- one-dark: `'#E5C07B', '#D19A66'` (yellow, orange)
- dracula: `'#F1FA8C', '#FFB86C'`
- monokai-pro: `'#FFD866', '#FC9867'`
- solarized-dark: `'#B58900', '#CB4B16'`
- solarized-light: `'#B58900', '#CB4B16'`
- nord: `'#EBCB8B', '#D08770'`
- gruvbox-dark: `'#FABD2F', '#FE8019'`
- tokyo-night: `'#E0AF68', '#FF9E64'`
- catppuccin-mocha: `'#F9E2AF', '#FAB387'`
- catppuccin-latte: `'#DF8E1D', '#FE640B'`
- rose-pine: `'#F6C177', '#EA9D34'`
- rose-pine-moon: `'#F6C177', '#EA9D34'`
- pastel-dark: `'#FFD580', '#FFAA5E'`
- kanagawa: `'#E6C384', '#FFA066'`
- everforest: `'#DBBC7F', '#E69875'`

- [ ] **Step 5: Update theme.ts — add waiting and stale to colors object**

In `src/ui/theme.ts`, add `waiting` and `stale` fields to the mutable `colors` object and ensure `applyTheme()` sets them.

- [ ] **Step 6: Build to verify**

Run: `npm run build 2>&1 | head -30`

- [ ] **Step 7: Commit**

```bash
git add src/config/themes.ts src/ui/theme.ts
git commit -m "feat(themes): add waiting and stale colour slots to ThemeColors and all presets"
```

---

## Task 4: Status Detection — readTailBytes and detectStatus

**Files:**
- Modify: `src/discovery/sessions.ts` (add readTailBytes, detectStatus, update sort)
- Modify: `src/discovery/sessionsAsync.ts` (add async versions, update sort)
- Test: `tests/session-status.test.ts`

- [ ] **Step 1: Write test for status detection**

Create `tests/session-status.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// we'll test the exported detectStatus helper
// for now, test the logic directly

describe('session status detection', () => {
  const parseLastEvent = (lines: string): Record<string, unknown> | null => {
    const allLines = lines.split('\n').filter(Boolean);
    if (allLines.length === 0) return null;
    try {
      return JSON.parse(allLines[allLines.length - 1]);
    } catch {
      return null;
    }
  };

  const deriveStatus = (
    lastEvent: Record<string, unknown> | null,
    hasPid: boolean,
    lastActivity: number,
    staleTimeout: number,
  ): 'waiting' | 'stale' | 'active' | 'inactive' => {
    if (!hasPid) return 'inactive';

    if (lastEvent && (lastEvent as { type?: string }).type === 'assistant') {
      const msg = (lastEvent as { message?: { content?: unknown[] } }).message;
      const content = msg?.content;
      if (Array.isArray(content)) {
        const hasAskUser = content.some(
          (b: unknown) => (b as { type?: string; name?: string }).type === 'tool_use' &&
            (b as { name?: string }).name === 'AskUserQuestion',
        );
        if (hasAskUser) return 'waiting';

        const hasToolUse = content.some((b: unknown) => (b as { type?: string }).type === 'tool_use');
        if (!hasToolUse) return 'waiting';
      }
    }

    if (Date.now() - lastActivity > staleTimeout * 1000) return 'stale';
    return 'active';
  };

  it('returns inactive when no pid', () => {
    expect(deriveStatus(null, false, Date.now(), 60)).toBe('inactive');
  });

  it('returns waiting when last event is text-only assistant', () => {
    const event = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'What would you like?' }] },
    };
    expect(deriveStatus(event, true, Date.now(), 60)).toBe('waiting');
  });

  it('returns waiting when last event has AskUserQuestion', () => {
    const event = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'question' },
          { type: 'tool_use', name: 'AskUserQuestion', input: {} },
        ],
      },
    };
    expect(deriveStatus(event, true, Date.now(), 60)).toBe('waiting');
  });

  it('returns active when last event has tool_use', () => {
    const event = {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] },
    };
    expect(deriveStatus(event, true, Date.now(), 60)).toBe('active');
  });

  it('returns stale when active but idle beyond timeout', () => {
    const event = {
      type: 'user',
      message: { content: [{ type: 'tool_result', content: 'ok' }] },
    };
    const oldActivity = Date.now() - 120_000; // 2 mins ago
    expect(deriveStatus(event, true, oldActivity, 60)).toBe('stale');
  });

  it('returns active when within timeout', () => {
    const event = {
      type: 'user',
      message: { content: [{ type: 'tool_result', content: 'ok' }] },
    };
    expect(deriveStatus(event, true, Date.now(), 60)).toBe('active');
  });
});
```

- [ ] **Step 1b: Write test for readTailBytes**

Add to `tests/session-status.test.ts`:

```typescript
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readTailBytes } from '../src/discovery/sessions.js';

describe('readTailBytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agenttop-test-'));

  it('reads last N bytes of file', () => {
    const file = join(dir, 'tail-test.txt');
    writeFileSync(file, 'line1\nline2\nline3\n');
    const tail = readTailBytes(file, 6);
    expect(tail).toBe('ine3\n');
  });

  it('reads entire file when smaller than requested bytes', () => {
    const file = join(dir, 'small.txt');
    writeFileSync(file, 'abc');
    const tail = readTailBytes(file, 4096);
    expect(tail).toBe('abc');
  });

  it('returns empty string for missing file', () => {
    expect(readTailBytes('/nonexistent/file', 100)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they work**

Run: `npx vitest run tests/session-status.test.ts`
Expected: Status logic tests PASS inline. `readTailBytes` tests will FAIL until step 3 (function not exported yet).

- [ ] **Step 3: Add readTailBytes to sessions.ts**

Add after `readFirstLines` (line 20):

```typescript
export const readTailBytes = (filePath: string, bytes: number): string => {
  try {
    const fd = openSync(filePath, 'r');
    const fstat = statSync(filePath);
    const start = Math.max(0, fstat.size - bytes);
    const readSize = Math.min(bytes, fstat.size);
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, start);
    closeSync(fd);
    return buf.toString('utf-8');
  } catch {
    return '';
  }
};
```

- [ ] **Step 4: Add detectStatus function to sessions.ts**

Add after `readTailBytes`:

```typescript
import type { SessionStatus } from './types.js';
import { loadConfig } from '../config/store.js';

// Note: staleTimeout is passed as a parameter to avoid calling loadConfig() per session
const detectStatus = (filePath: string, hasPid: boolean, lastActivity: number, staleTimeout: number): SessionStatus => {
  if (!hasPid) return 'inactive';

  const tail = readTailBytes(filePath, 4096);
  const lines = tail.split('\n').filter(Boolean);
  if (lines.length > 0) {
    try {
      const lastEvent = JSON.parse(lines[lines.length - 1]);
      if (lastEvent.type === 'assistant') {
        const content = lastEvent.message?.content;
        if (Array.isArray(content)) {
          // NOTE: AskUserQuestion is a Claude Code internal tool name — coupling point
          const hasAskUser = content.some(
            (b: { type?: string; name?: string }) => b.type === 'tool_use' && b.name === 'AskUserQuestion',
          );
          if (hasAskUser) return 'waiting';
          const hasToolUse = content.some((b: { type?: string }) => b.type === 'tool_use');
          if (!hasToolUse) return 'waiting';
        }
      }
    } catch {
      // malformed last line, skip
    }
  }

  if (Date.now() - lastActivity > staleTimeout * 1000) return 'stale';
  return 'active';
};
```

- [ ] **Step 5: Wire detectStatus into session construction in discoverFromProjects**

At the top of `discoverSessions()`, load the stale timeout once:

```typescript
import { loadConfig } from '../config/store.js';
// ... inside discoverSessions:
const staleTimeout = loadConfig().alerts.staleTimeout ?? 60;
```

Pass it through to `discoverFromProjects` and `discoverFromTmp` as a parameter.

In `discoverFromProjects`, after building the session object (around line 140-158), add status:

```typescript
const session: Session = {
  // ... existing fields ...
  usage: meta.usage,
  status: detectStatus(filePath, matchingProcess !== undefined, fstat.mtimeMs, staleTimeout),
};
```

Do the same in `discoverFromTmp` (around line 272-290), using the latest output file:

```typescript
const latestFile = outputFiles.reduce((a, b) => {
  try {
    return statSync(a).mtimeMs > statSync(b).mtimeMs ? a : b;
  } catch {
    return a;
  }
});

const session: Session = {
  // ... existing fields ...
  usage: totalUsage,
  status: detectStatus(latestFile, matchingProcess !== undefined, lastActivity, staleTimeout),
};
```

- [ ] **Step 6: Update sort in discoverSessions**

Replace the sort at lines 305-310:

```typescript
return Array.from(sessionMap.values()).sort((a, b) => {
  const aPri = STATUS_PRIORITY[a.status];
  const bPri = STATUS_PRIORITY[b.status];
  if (aPri !== bPri) return aPri - bPri;
  return b.lastActivity - a.lastActivity;
});
```

Import `STATUS_PRIORITY` from `./types.js`.

- [ ] **Step 7: Apply same changes to sessionsAsync.ts**

Add async `readTailBytesAsync` using `fs/promises`:

```typescript
import { open, stat as statAsync } from 'node:fs/promises';

const readTailBytesAsync = async (filePath: string, bytes: number): Promise<string> => {
  try {
    const fstat = await statAsync(filePath);
    const start = Math.max(0, fstat.size - bytes);
    const readSize = Math.min(bytes, fstat.size);
    const fh = await open(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    await fh.read(buf, 0, readSize, start);
    await fh.close();
    return buf.toString('utf-8');
  } catch {
    return '';
  }
};
```

Add async `detectStatusAsync` (same logic as sync but using async file reads).

Wire into both `discoverFromProjectsAsync` and `discoverFromTmpAsync`.

Update the sort at lines 237-242 to use `STATUS_PRIORITY`.

- [ ] **Step 8: Build and test**

Run: `npm run build && npx vitest run tests/session-status.test.ts`
Expected: Build succeeds (may still have errors in UI files). Tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/discovery/sessions.ts src/discovery/sessionsAsync.ts tests/session-status.test.ts
git commit -m "feat(discovery): add session status detection with waiting, stale, active, inactive states"
```

---

## Task 5: SessionList UI — Status indicators and colours

**Files:**
- Modify: `src/ui/components/SessionList.tsx`

- [ ] **Step 1: Update group rendering to use status instead of isActive**

Replace references to `g.isActive` (lines 88-90) with status-based logic:

```typescript
const dotColor = g.status === 'waiting' ? colors.waiting
  : g.status === 'stale' ? colors.stale
  : g.status === 'active' ? colors.success
  : colors.muted;
const statusDot = g.status === 'inactive' ? '\u25cb' : '\u25cf';
const nameColor = isSelected ? colors.bright
  : g.status === 'active' || g.status === 'waiting' || g.status === 'stale'
  ? colors.secondary : colors.text;
```

Add status tag for groups:

```typescript
const statusTag = g.status === 'waiting' ? ' [waiting]'
  : g.status === 'stale' ? ' [stale]' : '';
const label = truncate(`${g.key} (${g.sessions.length})${statusTag}`, INNER_WIDTH - 4);
```

- [ ] **Step 2: Update session rendering to use session.status**

Replace all `const isActive = session.pid !== null;` (line 114) and `isActive` references with `session.status`:

```typescript
const dotColor = session.status === 'waiting' ? colors.waiting
  : session.status === 'stale' ? colors.stale
  : session.status === 'active' ? colors.success
  : colors.muted;
const statusDot = session.status === 'inactive' ? '\u25cb' : '\u25cf';
```

Add status tag for individual sessions:

```typescript
const statusTag = session.status === 'waiting' ? ' [waiting]'
  : session.status === 'stale' ? ' [stale]' : '';
```

Include `statusTag` in the display name for both grouped and ungrouped sessions.

- [ ] **Step 3: Build to verify**

Run: `npm run build 2>&1 | head -30`
Expected: Closer to clean build. May still have errors in other files referencing `isActive`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/SessionList.tsx
git commit -m "feat(ui): render session status indicators with waiting/stale colours and tags"
```

---

## Task 6: Fix all remaining isActive references

**Files:**
- Multiple files that reference `SessionGroup.isActive` or construct `SessionGroup` objects
- `src/ui/components/ActivityFeed.tsx` — has `isActive?: boolean` prop
- `src/ui/App.tsx` and `src/ui/components/SplitPanel.tsx` — pass `session.pid !== null` to ActivityFeed
- **Exclude** `src/ui/components/ThemeMenu.tsx` — its `isActive` is unrelated (means "currently selected theme")

- [ ] **Step 1: Find all isActive references**

Run: `grep -rn 'isActive' src/`

- [ ] **Step 2: Update SessionGroup construction**

For files constructing `SessionGroup` objects (likely in `useSessions.ts` or `App.tsx`), replace:

```typescript
isActive: sessions.some(s => s.pid !== null),
```

with:

```typescript
status: sessions.reduce((best, s) => {
  const STATUS_PRIORITY: Record<string, number> = { waiting: 0, stale: 1, active: 2, inactive: 3 };
  return (STATUS_PRIORITY[s.status] ?? 3) < (STATUS_PRIORITY[best] ?? 3) ? s.status : best;
}, 'inactive' as SessionStatus),
```

Import `SessionStatus` from `./types.js` where needed.

- [ ] **Step 3: Update ActivityFeed isActive prop**

In `ActivityFeed.tsx`, change the `isActive?: boolean` prop to `status?: SessionStatus`. Update any rendering logic that uses `isActive` to use `status` instead (e.g., colour choices).

In `App.tsx` and `SplitPanel.tsx`, change where they pass `isActive={session.pid !== null}` to instead pass `status={session.status}`.

- [ ] **Step 4: Build until clean**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/ActivityFeed.tsx src/ui/App.tsx src/ui/components/SplitPanel.tsx src/ui/hooks/useSessions.ts src/ui/components/SessionList.tsx
git commit -m "refactor: replace isActive with status across all SessionGroup and ActivityFeed references"
```

---

## Task 7: Custom Alert Rules Engine

**Files:**
- Create: `src/analysis/rules/custom.ts`
- Modify: `src/analysis/security.ts`
- Test: `tests/custom-rules.test.ts`

- [ ] **Step 1: Write tests for custom rules**

Create `tests/custom-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createCustomRules } from '../src/analysis/rules/custom.js';
import type { ToolCall, ToolResult } from '../src/discovery/types.js';

const makeCall = (toolName: string, toolInput: Record<string, unknown>): ToolCall => ({
  sessionId: 'test-session',
  agentId: 'test-agent',
  slug: 'test-slug',
  timestamp: Date.now(),
  toolName,
  toolInput,
  cwd: '/tmp',
});

const makeResult = (content: string): ToolResult => ({
  sessionId: 'test-session',
  agentId: 'test-agent',
  slug: 'test-slug',
  timestamp: Date.now(),
  toolUseId: 'tool-1',
  content,
  isError: false,
  cwd: '/tmp',
});

describe('custom rules', () => {
  it('matches tool input with regex', () => {
    const rules = createCustomRules([
      { name: 'rm-rf', pattern: 'rm\\s+-rf', match: 'input', severity: 'high', message: 'dangerous rm', enabled: true },
    ]);
    expect(rules.length).toBe(1);
    const alert = rules[0](makeCall('Bash', { command: 'rm -rf /' }));
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('high');
  });

  it('does not match when pattern not found', () => {
    const rules = createCustomRules([
      { name: 'rm-rf', pattern: 'rm\\s+-rf', match: 'input', severity: 'high', message: 'dangerous rm', enabled: true },
    ]);
    const alert = rules[0](makeCall('Bash', { command: 'ls -la' }));
    expect(alert).toBeNull();
  });

  it('matches tool output', () => {
    const rules = createCustomRules([
      { name: 'secret', pattern: 'API_KEY', match: 'output', severity: 'critical', message: 'secret found', enabled: true },
    ]);
    const alert = rules[0](makeResult('found API_KEY=abc123'));
    expect(alert).not.toBeNull();
  });

  it('does not match tool call when match is output', () => {
    const rules = createCustomRules([
      { name: 'secret', pattern: 'API_KEY', match: 'output', severity: 'critical', message: 'secret found', enabled: true },
    ]);
    const alert = rules[0](makeCall('Bash', { command: 'echo API_KEY' }));
    expect(alert).toBeNull();
  });

  it('matches toolName', () => {
    const rules = createCustomRules([
      { name: 'no-write', pattern: 'Write', match: 'toolName', severity: 'warn', message: 'write detected', enabled: true },
    ]);
    const alert = rules[0](makeCall('Write', { file_path: '/tmp/x' }));
    expect(alert).not.toBeNull();
  });

  it('matches all targets', () => {
    const rules = createCustomRules([
      { name: 'secret', pattern: 'secret', match: 'all', severity: 'warn', message: 'secret', enabled: true },
    ]);
    expect(rules[0](makeCall('Bash', { command: 'echo secret' }))).not.toBeNull();
    expect(rules[0](makeResult('a secret here'))).not.toBeNull();
  });

  it('skips invalid regex', () => {
    const rules = createCustomRules([
      { name: 'bad', pattern: '[invalid', match: 'all', severity: 'warn', message: 'bad', enabled: true },
    ]);
    expect(rules.length).toBe(0);
  });

  it('skips disabled rules', () => {
    const rules = createCustomRules([
      { name: 'off', pattern: 'test', match: 'all', severity: 'warn', message: 'off', enabled: false },
    ]);
    expect(rules.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/custom-rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement custom.ts**

Create `src/analysis/rules/custom.ts`:

```typescript
import type { SecurityEvent, Alert } from '../../discovery/types.js';
import { isToolCall, isToolResult } from '../../discovery/types.js';
import type { CustomAlertRule } from '../../config/store.js';

type SecurityEventRule = (event: SecurityEvent) => Alert | null;

export const createCustomRules = (rules: CustomAlertRule[]): SecurityEventRule[] => {
  const compiled: SecurityEventRule[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern);
    } catch {
      continue;
    }

    const fn: SecurityEventRule = (event: SecurityEvent): Alert | null => {
      let matched = false;

      if (isToolCall(event)) {
        if (rule.match === 'toolName' || rule.match === 'all') {
          if (regex.test(event.toolName)) matched = true;
        }
        if (!matched && (rule.match === 'input' || rule.match === 'all')) {
          if (regex.test(JSON.stringify(event.toolInput))) matched = true;
        }
        if (rule.match === 'output') return null;
      }

      if (isToolResult(event)) {
        if (rule.match === 'output' || rule.match === 'all') {
          if (regex.test(event.content)) matched = true;
        }
        if (rule.match === 'input' || rule.match === 'toolName') return null;
      }

      if (!matched) return null;

      return {
        id: `custom-${rule.name}-${event.timestamp}`,
        severity: rule.severity,
        rule: `custom:${rule.name}`,
        message: rule.message || rule.name,
        sessionSlug: isToolCall(event) ? event.slug : event.slug,
        sessionId: isToolCall(event) ? event.sessionId : event.sessionId,
        event,
        timestamp: event.timestamp,
      };
    };

    compiled.push(fn);
  }

  return compiled;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/custom-rules.test.ts`
Expected: All PASS.

- [ ] **Step 5: Wire custom rules into SecurityEngine**

In `src/analysis/security.ts`, update constructor to accept custom rules:

```typescript
import { createCustomRules } from './rules/custom.js';
import type { CustomAlertRule } from '../config/store.js';

// In constructor, add customRules parameter:
constructor(
  minLevel: AlertSeverity = 'warn',
  rulesConfig?: SecurityRulesConfig,
  customRules?: CustomAlertRule[],
) {
  this.minLevel = minLevel;
  this.rulesConfig = rulesConfig ?? { ... };

  if (customRules && customRules.length > 0) {
    const compiled = createCustomRules(customRules);
    for (const fn of compiled) {
      allEventRules.push({ key: 'injection' as keyof SecurityRulesConfig, fn });
    }
  }
}
```

Store custom event rules in a separate private array (do NOT push into `allEventRules` — that's a module-level array shared across instances):

```typescript
private customEventRules: SecurityEventRule[] = [];

// In constructor:
if (customRules && customRules.length > 0) {
  this.customEventRules = createCustomRules(customRules);
}

// In analyzeEvent, after the allEventRules loop:
for (const fn of this.customEventRules) {
  const alert = fn(event);
  if (alert) alerts.push(alert);
}
```

- [ ] **Step 6: Build and run all tests**

Run: `npm run build && npx vitest run`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/analysis/rules/custom.ts src/analysis/security.ts tests/custom-rules.test.ts
git commit -m "feat(security): add custom regex alert rules engine"
```

---

## Task 8: Bootleg Pop Culture Themes

**Files:**
- Modify: `src/config/themes.ts` (add 12 new presets)

- [ ] **Step 1: Add 12 bootleg theme presets**

Add to the `PRESETS` array after the existing 15 entries. Each is a `PresetTuple` with 15 values (name + 12 existing colours + waiting + stale):

```typescript
// bootleg pop culture themes
['hi-feline', '#FF6B8A', '#FFB3C6', '#FF1744', '#FFE082', '#FF5252', '#FF0000', '#C48B9F', '#FFE4EC', '#FFFFFF', '#4A2030', '#3A1525', '#FF6B8A', '#FFE082', '#FFA726'],
['plumber-bros', '#4CAF50', '#F44336', '#2196F3', '#FFD700', '#FF5722', '#FF0000', '#795548', '#EFEBE9', '#FFFFFF', '#1B5E20', '#0D3010', '#4CAF50', '#FFD700', '#FF9800'],
['hedgehog-speed', '#1565C0', '#FFD700', '#4CAF50', '#FFEB3B', '#F44336', '#FF0000', '#5C6BC0', '#E8EAF6', '#FFFFFF', '#0D47A1', '#0A2E6E', '#1565C0', '#FFEB3B', '#FF9800'],
['block-craft', '#4CAF50', '#8D6E63', '#795548', '#FFEB3B', '#F44336', '#FF0000', '#78909C', '#BCAAA4', '#FFFFFF', '#33691E', '#1B4400', '#4CAF50', '#FFEB3B', '#FF9800'],
['galaxy-conflicts', '#F44336', '#2196F3', '#9C27B0', '#FFD54F', '#FF1744', '#FF0000', '#546E7A', '#ECEFF1', '#FFFFFF', '#1A1A2E', '#0D0D1A', '#F44336', '#FFD54F', '#FF6D00'],
['pocket-creatures', '#F44336', '#FFFFFF', '#FFEB3B', '#FFC107', '#E53935', '#FF0000', '#90A4AE', '#ECEFF1', '#FFFFFF', '#B71C1C', '#7F0000', '#F44336', '#FFC107', '#FF9800'],
['brick-wizard', '#7B1FA2', '#FFD700', '#880E4F', '#FFC107', '#F44336', '#FF0000', '#6A1B9A', '#E1BEE7', '#FFFFFF', '#311B92', '#1A0A52', '#7B1FA2', '#FFC107', '#FF9800'],
['caped-knight', '#616161', '#FDD835', '#424242', '#FFC107', '#F44336', '#FF0000', '#757575', '#E0E0E0', '#FFFFFF', '#212121', '#0A0A0A', '#616161', '#FFC107', '#FF9800'],
['web-crawler', '#F44336', '#1565C0', '#FFFFFF', '#FFEB3B', '#D50000', '#FF0000', '#78909C', '#E3F2FD', '#FFFFFF', '#B71C1C', '#7F0000', '#F44336', '#FFEB3B', '#FF9800'],
['frozen-kingdom', '#81D4FA', '#CE93D8', '#B3E5FC', '#FFF9C4', '#EF9A9A', '#FF0000', '#90CAF9', '#E1F5FE', '#FFFFFF', '#1A237E', '#0D1252', '#81D4FA', '#FFF9C4', '#FFCC80'],
['coral-reef', '#FF7043', '#29B6F6', '#AB47BC', '#FFEE58', '#EF5350', '#FF0000', '#4DB6AC', '#E0F7FA', '#FFFFFF', '#BF360C', '#7F2008', '#FF7043', '#FFEE58', '#FFA726'],
['toy-ranch', '#8D6E63', '#7CB342', '#7E57C2', '#FFEE58', '#EF5350', '#FF0000', '#90A4AE', '#EFEBE9', '#FFFFFF', '#4E342E', '#2E1C15', '#8D6E63', '#FFEE58', '#FFA726'],
```

- [ ] **Step 2: Run theme tests**

Run: `npx vitest run tests/themes.test.ts`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/config/themes.ts
git commit -m "feat(themes): add 12 bootleg pop culture themes"
```

---

## Task 9: Theme Menu Disclaimer

**Files:**
- Modify: `src/ui/components/ThemeMenu.tsx`

- [ ] **Step 1: Add disclaimer text**

At the bottom of the ThemeMenu component's return JSX, add before the closing `</Box>` of the outer container:

```tsx
<Box paddingX={1} marginTop={1}>
  <Text color={colors.muted} dimColor italic wrap="truncate">
    Some themes were inspired by pop culture. Names have been changed to protect the innocent (and our legal team).
  </Text>
</Box>
```

- [ ] **Step 2: Build and manually verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/ThemeMenu.tsx
git commit -m "feat(ui): add bootleg theme disclaimer to theme menu"
```

---

## Task 10: Alert Rules TUI Menu

**Files:**
- Create: `src/ui/components/AlertRulesMenu.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/hooks/useKeyHandler.ts`

- [ ] **Step 1: Create AlertRulesMenu component**

Create `src/ui/components/AlertRulesMenu.tsx`. This is a modal component similar to SettingsMenu. It should:

- Accept props: `config: Config`, `onClose: () => void`, `onSave: (config: Config) => void`
- State: `selectedIndex`, `editMode` (null | 'new' | 'edit'), `editForm` (name, pattern, match, severity, message), `error` (string for regex validation)
- Display: built-in rules (toggleable), custom rules (with pattern preview), stale timeout
- Key handling: scoped to the modal (n/e/d/space/+/-/Esc)
- On save: validate regex with `new RegExp()`, persist via `onSave`

The component structure follows the pattern of `SettingsMenu.tsx` and `ThemeMenu.tsx` — a full-screen overlay with a bordered box, list of items, and footer keybindings.

```tsx
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

import type { Config, CustomAlertRule } from '../../config/store.js';
import { colors } from '../theme.js';

interface AlertRulesMenuProps {
  config: Config;
  onClose: () => void;
  onSave: (config: Config) => void;
}

// Item types for the list
type ListItem =
  | { type: 'header'; label: string }
  | { type: 'builtin'; key: string; label: string; severity: string; enabled: boolean }
  | { type: 'custom'; rule: CustomAlertRule; index: number }
  | { type: 'stale' };

export const AlertRulesMenu: React.FC<AlertRulesMenuProps> = ({ config, onClose, onSave }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editMode, setEditMode] = useState<null | 'new' | 'edit'>(null);
  const [editForm, setEditForm] = useState<Partial<CustomAlertRule>>({});
  const [editField, setEditField] = useState(0); // which field is being edited
  const [editBuffer, setEditBuffer] = useState('');
  const [error, setError] = useState('');

  // Build list items
  const items: ListItem[] = [];
  items.push({ type: 'header', label: 'Built-in Rules' });

  const builtinRules = [
    { key: 'network', label: 'network', severity: 'warn' },
    { key: 'exfiltration', label: 'exfiltration', severity: 'critical' },
    { key: 'sensitiveFiles', label: 'sensitive-files', severity: 'warn' },
    { key: 'shellEscape', label: 'shell-escape', severity: 'high' },
    { key: 'injection', label: 'injection', severity: 'critical' },
  ];

  for (const r of builtinRules) {
    items.push({
      type: 'builtin',
      key: r.key,
      label: r.label,
      severity: r.severity,
      enabled: config.security.rules[r.key as keyof typeof config.security.rules],
    });
  }

  items.push({ type: 'header', label: 'Custom Rules' });

  for (let i = 0; i < (config.alerts.custom ?? []).length; i++) {
    items.push({ type: 'custom', rule: config.alerts.custom[i], index: i });
  }

  items.push({ type: 'stale' });

  // Selectable items (skip headers)
  const selectableIndices = items.map((_, i) => i).filter((i) => items[i].type !== 'header');
  const clampedIndex = Math.min(selectedIndex, selectableIndices.length - 1);
  const actualIndex = selectableIndices[clampedIndex] ?? 0;

  useInput((input, key) => {
    if (editMode) {
      // Handle edit form input — simplified inline editing
      // ... (handle text input for each field, Enter to advance, Esc to cancel)
      return;
    }

    if (key.escape) { onClose(); return; }
    if (key.upArrow) { setSelectedIndex(Math.max(0, clampedIndex - 1)); return; }
    if (key.downArrow) { setSelectedIndex(Math.min(selectableIndices.length - 1, clampedIndex + 1)); return; }

    const item = items[actualIndex];

    if (input === ' ' && item) {
      if (item.type === 'builtin') {
        const newConfig = { ...config, security: { ...config.security, rules: { ...config.security.rules } } };
        const k = item.key as keyof typeof newConfig.security.rules;
        newConfig.security.rules[k] = !newConfig.security.rules[k];
        onSave(newConfig);
      }
      if (item.type === 'custom') {
        const newCustom = [...(config.alerts.custom ?? [])];
        newCustom[item.index] = { ...newCustom[item.index], enabled: !newCustom[item.index].enabled };
        onSave({ ...config, alerts: { ...config.alerts, custom: newCustom } });
      }
    }

    if (input === 'n') {
      setEditMode('new');
      setEditForm({ name: '', pattern: '', match: 'all', severity: 'warn', message: '', enabled: true });
      setEditField(0);
      setEditBuffer('');
      setError('');
    }

    if (input === 'e' && item?.type === 'custom') {
      setEditMode('edit');
      setEditForm({ ...item.rule });
      setEditField(0);
      setEditBuffer(item.rule.name);
      setError('');
    }

    if (input === 'd' && item?.type === 'custom') {
      const newCustom = [...(config.alerts.custom ?? [])];
      newCustom.splice(item.index, 1);
      onSave({ ...config, alerts: { ...config.alerts, custom: newCustom } });
    }

    if (input === '+' || input === '=') {
      const newTimeout = (config.alerts.staleTimeout ?? 60) + 15;
      onSave({ ...config, alerts: { ...config.alerts, staleTimeout: newTimeout } });
    }
    if (input === '-') {
      const newTimeout = Math.max(15, (config.alerts.staleTimeout ?? 60) - 15);
      onSave({ ...config, alerts: { ...config.alerts, staleTimeout: newTimeout } });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={colors.primary} paddingX={1}>
      <Text color={colors.header} bold> Alert Rules </Text>
      <Text> </Text>
      {items.map((item, i) => {
        const isSelected = i === actualIndex;
        if (item.type === 'header') {
          return <Text key={`h-${i}`} color={colors.accent} bold>{item.label}</Text>;
        }
        if (item.type === 'builtin') {
          return (
            <Text key={`b-${item.key}`} backgroundColor={isSelected ? colors.selected : undefined}>
              {isSelected ? '\u25b8' : ' '} {item.enabled ? '\u25cf' : '\u25cb'} {item.label.padEnd(18)} [{item.severity}] {item.enabled ? 'enabled' : 'disabled'}
            </Text>
          );
        }
        if (item.type === 'custom') {
          const r = item.rule;
          return (
            <Text key={`c-${r.name}`} backgroundColor={isSelected ? colors.selected : undefined}>
              {isSelected ? '\u25b8' : ' '} {r.enabled ? '\u25cf' : '\u25cb'} {r.name.padEnd(18)} [{r.severity}] {r.pattern.slice(0, 30)}
            </Text>
          );
        }
        if (item.type === 'stale') {
          return (
            <Text key="stale" backgroundColor={isSelected ? colors.selected : undefined}>
              {isSelected ? '\u25b8' : ' '} Stale Timeout: {config.alerts.staleTimeout ?? 60}s   Severity: {config.alerts.staleAlertSeverity ?? 'warn'}
            </Text>
          );
        }
        return null;
      })}
      <Text> </Text>
      {error && <Text color={colors.error}>{error}</Text>}
      <Text color={colors.muted}>[n] New  [e] Edit  [d] Delete  [space] Toggle  [+/-] Stale timeout  [Esc] Back</Text>
    </Box>
  );
};
```

This is a starting scaffold — the edit form handling (text input for name, pattern, match, severity, message fields) should follow the pattern used in the nickname input or ThemeMenu naming flow.

- [ ] **Step 2: Wire AlertRulesMenu into App.tsx**

Add state:

```typescript
const [showAlertRules, setShowAlertRules] = useState(false);
```

Add to the render, alongside SettingsMenu:

```tsx
{showAlertRules && (
  <AlertRulesMenu
    config={config}
    onClose={() => setShowAlertRules(false)}
    onSave={(newConfig) => { saveConfig(newConfig); setConfig(newConfig); }}
  />
)}
```

- [ ] **Step 3: Wire keybinding in useKeyHandler**

In the guard at line 96, add `d.showAlertRules`:

```typescript
if (d.showSetup || d.showSettings || d.confirmAction || d.showUpdateModal || d.showAlertRules) return;
```

Add the keybinding check near the settings key (around line 274):

```typescript
if (matchKey(d.kb.alertRules, input, key)) {
  d.setShowAlertRules(true);
  return;
}
```

Add `showAlertRules` and `setShowAlertRules` to `KeyHandlerDeps`.

- [ ] **Step 4: Build and test**

Run: `npm run build && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/AlertRulesMenu.tsx src/ui/App.tsx src/ui/hooks/useKeyHandler.ts
git commit -m "feat(ui): add alert rules TUI management screen"
```

---

## Task 11: MCP Server Extensions

**Files:**
- Modify: `src/mcp/server.ts`

- [ ] **Step 1: Add new tool definitions to ListToolsRequestSchema handler**

Add 7 new tools after the existing 4 tools in the `tools` array (after line 105):

```typescript
{
  name: 'agenttop_waiting_sessions',
  description: 'List sessions in waiting or stale state with time in that state',
  inputSchema: { type: 'object' as const, properties: {} },
},
{
  name: 'agenttop_session_status',
  description: 'Get status for a specific session (waiting, stale, active, inactive)',
  inputSchema: {
    type: 'object' as const,
    properties: { sessionId: { type: 'string', description: 'Session ID' } },
    required: ['sessionId'],
  },
},
{
  name: 'agenttop_custom_alerts',
  description: 'List configured custom alert rules',
  inputSchema: { type: 'object' as const, properties: {} },
},
{
  name: 'agenttop_set_custom_alert',
  description: 'Add or update a custom alert rule',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Rule name (unique)' },
      pattern: { type: 'string', description: 'Regex pattern' },
      match: { type: 'string', enum: ['input', 'output', 'toolName', 'all'], description: 'Match target (default: all)' },
      severity: { type: 'string', enum: ['info', 'warn', 'high', 'critical'], description: 'Alert severity (default: warn)' },
      message: { type: 'string', description: 'Alert message' },
    },
    required: ['name', 'pattern'],
  },
},
{
  name: 'agenttop_delete_custom_alert',
  description: 'Delete a custom alert rule by name',
  inputSchema: {
    type: 'object' as const,
    properties: { name: { type: 'string', description: 'Rule name to delete' } },
    required: ['name'],
  },
},
{
  name: 'agenttop_alert_history',
  description: 'Get recent alerts (built-in + custom), filterable by severity',
  inputSchema: {
    type: 'object' as const,
    properties: {
      severity: { type: 'string', enum: ['info', 'warn', 'high', 'critical'], description: 'Min severity' },
      limit: { type: 'number', description: 'Max alerts (default 50)' },
    },
  },
},
{
  name: 'agenttop_set_stale_timeout',
  description: 'Set the stale timeout in seconds',
  inputSchema: {
    type: 'object' as const,
    properties: { seconds: { type: 'number', description: 'Timeout in seconds (min 15)' } },
    required: ['seconds'],
  },
},
```

- [ ] **Step 2: Add handler cases**

Add `case` blocks in the `CallToolRequestSchema` handler switch:

```typescript
case 'agenttop_sessions': {
  const sessions = discoverSessions(allUsers);
  const data = sessions.map((s) => ({
    sessionId: s.sessionId,
    slug: s.slug,
    model: s.model,
    cwd: s.cwd,
    status: s.status,  // NEW
    cpu: s.cpu,
    memMB: s.memMB,
    agents: s.agentCount,
    tokens: { input: s.usage.inputTokens, output: s.usage.outputTokens, cacheRead: s.usage.cacheReadTokens },
  }));
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
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
  try { new RegExp(pattern); } catch { return { content: [{ type: 'text', text: `Invalid regex: ${pattern}` }], isError: true }; }
  const cfg = loadConfig();
  const custom = [...(cfg.alerts.custom ?? [])];
  const existing = custom.findIndex((r) => r.name === name);
  const rule = {
    name,
    pattern,
    match: (args?.match as string ?? 'all') as 'input' | 'output' | 'toolName' | 'all',
    severity: (args?.severity as string ?? 'warn') as 'info' | 'warn' | 'high' | 'critical',
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
  // Read from the alerts.jsonl log file (not in-memory — MCP server's in-memory
  // alerts only capture events since MCP server startup, while the log file has
  // the full history across all sessions)
  const severity = (args?.severity as AlertSeverity) ?? 'info';
  const limit = (args?.limit as number) ?? 50;
  const order: Record<string, number> = { info: 0, warn: 1, high: 2, critical: 3 };
  const minOrder = order[severity] ?? 0;
  const cfg = loadConfig();
  const logPath = resolveAlertLogPath(cfg);
  let logAlerts: { severity: string; rule: string; message: string; sessionSlug: string; timestamp: string }[] = [];
  try {
    const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const a = JSON.parse(line);
        if ((order[a.severity] ?? 0) >= minOrder) {
          logAlerts.push({
            severity: a.severity,
            rule: a.rule,
            message: a.message,
            sessionSlug: a.sessionSlug,
            timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : 'unknown',
          });
        }
      } catch { continue; }
    }
  } catch { /* no log file yet */ }
  // Also include in-memory alerts from this MCP session
  for (const a of alerts) {
    if ((order[a.severity] ?? 0) >= minOrder) {
      logAlerts.push({
        severity: a.severity,
        rule: a.rule,
        message: a.message,
        sessionSlug: a.sessionSlug,
        timestamp: new Date(a.timestamp).toISOString(),
      });
    }
  }
  const result = logAlerts.slice(-limit);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

case 'agenttop_set_stale_timeout': {
  const seconds = Math.max(15, (args?.seconds as number) ?? 60);
  const cfg = loadConfig();
  cfg.alerts.staleTimeout = seconds;
  saveConfig(cfg);
  return { content: [{ type: 'text', text: `Stale timeout set to ${seconds}s` }] };
}
```

Add imports:
```typescript
import { readFileSync } from 'node:fs';
import { loadConfig, saveConfig, resolveAlertLogPath } from '../config/store.js';
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/server.ts
git commit -m "feat(mcp): add 7 new MCP tools for session status, custom alerts, and alert management"
```

---

## Task 12: Stream Mode — Add status field

**Files:**
- Modify: `src/stream.ts`

- [ ] **Step 1: Add status to session output**

In the plain text mode (line 20), add status:

```typescript
write(
  `SESSION ${s.slug} | ${s.status} | ${s.model} | ${s.cwd} | CPU ${s.cpu}% | ${s.memMB}MB | ${formatTokens(s.usage.inputTokens)} in / ${formatTokens(s.usage.outputTokens)} out`,
);
```

In the JSON mode (line 16), the session data already includes all fields via `JSON.stringify`, so `status` is included automatically.

- [ ] **Step 2: Build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/stream.ts
git commit -m "feat(stream): add session status to streaming output"
```

---

## Task 13: Pinned Sessions

**Files:**
- Modify: `src/config/store.ts` (add `pinnedSessions` to Config, add pin keybindings)
- Modify: `src/discovery/types.ts` (add `pinned` field to Session)
- Modify: `src/discovery/sessions.ts` (update sort to account for pinning)
- Modify: `src/discovery/sessionsAsync.ts` (same sort update)
- Modify: `src/ui/components/SessionList.tsx` (pin indicator)
- Modify: `src/ui/hooks/useKeyHandler.ts` (pin/reorder keybindings)
- Modify: `src/ui/App.tsx` (pin state management)
- Modify: `src/mcp/server.ts` (pin/unpin tools)

- [ ] **Step 1: Add pinnedSessions to Config**

In `src/config/store.ts`, add to the `Config` interface:

```typescript
pinnedSessions: string[];  // ordered array of session IDs
```

Add to `defaultConfig()`:

```typescript
pinnedSessions: [],
```

Add to `KeybindingsConfig`:

```typescript
pin: string;
pinMoveUp: string;
pinMoveDown: string;
```

Add to keybindings defaults:

```typescript
pin: 'p',
pinMoveUp: 'P',
pinMoveDown: 'ctrl+p',
```

Add helper functions:

```typescript
export const pinSession = (sessionId: string): void => {
  const config = loadConfig();
  if (!config.pinnedSessions.includes(sessionId)) {
    config.pinnedSessions.push(sessionId);
    saveConfig(config);
  }
};

export const unpinSession = (sessionId: string): void => {
  const config = loadConfig();
  config.pinnedSessions = config.pinnedSessions.filter((id) => id !== sessionId);
  saveConfig(config);
};

export const movePinned = (sessionId: string, direction: 'up' | 'down'): void => {
  const config = loadConfig();
  const idx = config.pinnedSessions.indexOf(sessionId);
  if (idx === -1) return;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= config.pinnedSessions.length) return;
  config.pinnedSessions.splice(idx, 1);
  config.pinnedSessions.splice(newIdx, 0, sessionId);
  saveConfig(config);
};

export const getPinnedSessions = (): string[] => loadConfig().pinnedSessions;
```

- [ ] **Step 2: Add pinned field to Session type**

In `src/discovery/types.ts`, add to Session:

```typescript
pinned: boolean;
```

- [ ] **Step 3: Update sort logic in sessions.ts**

Replace the sort in `discoverSessions()` to account for pinning:

```typescript
import { loadConfig } from '../config/store.js';

// In discoverSessions, after building sessionMap:
const config = loadConfig();
const pinnedOrder = config.pinnedSessions ?? [];

// Set pinned flag on each session
for (const session of sessionMap.values()) {
  session.pinned = pinnedOrder.includes(session.sessionId);
}

return Array.from(sessionMap.values()).sort((a, b) => {
  const aPin = pinnedOrder.indexOf(a.sessionId);
  const bPin = pinnedOrder.indexOf(b.sessionId);
  const aIsPinned = aPin !== -1;
  const bIsPinned = bPin !== -1;

  if (aIsPinned && !bIsPinned) return -1;
  if (!aIsPinned && bIsPinned) return 1;
  if (aIsPinned && bIsPinned) return aPin - bPin;

  const aPri = STATUS_PRIORITY[a.status];
  const bPri = STATUS_PRIORITY[b.status];
  if (aPri !== bPri) return aPri - bPri;
  return b.lastActivity - a.lastActivity;
});
```

Apply the same sort to `sessionsAsync.ts`.

- [ ] **Step 4: Add pin indicator to SessionList**

In `SessionList.tsx`, for each session display, add a pin marker before the status dot:

```typescript
const pinMarker = session.pinned ? '* ' : '  ';
// In the Text component:
{pinMarker}<Text color={dotColor}>{statusDot}</Text> {displayName}
```

For groups, show pin marker if any member is pinned:

```typescript
const groupPinned = g.sessions.some(s => s.pinned);
const pinMarker = groupPinned ? '* ' : '  ';
```

- [ ] **Step 5: Add pin keybindings to useKeyHandler**

Add `matchKey(d.kb.pin, ...)` check near the nickname key handler:

```typescript
if (matchKey(d.kb.pin, input, key) && d.selectedSession) {
  d.onTogglePin(d.selectedSession.sessionId);
  return;
}
if (matchKey(d.kb.pinMoveUp, input, key) && d.selectedSession?.pinned) {
  d.onMovePinned(d.selectedSession.sessionId, 'up');
  return;
}
if (matchKey(d.kb.pinMoveDown, input, key) && d.selectedSession?.pinned) {
  d.onMovePinned(d.selectedSession.sessionId, 'down');
  return;
}
```

Add `onTogglePin` and `onMovePinned` to `KeyHandlerDeps`.

- [ ] **Step 6: Wire pin actions in App.tsx**

Add handlers:

```typescript
const handleTogglePin = useCallback((sessionId: string) => {
  const pinned = getPinnedSessions();
  if (pinned.includes(sessionId)) unpinSession(sessionId);
  else pinSession(sessionId);
  refresh();
}, [refresh]);

const handleMovePinned = useCallback((sessionId: string, dir: 'up' | 'down') => {
  movePinned(sessionId, dir);
  refresh();
}, [refresh]);
```

Pass to useKeyHandler deps.

- [ ] **Step 7: Add MCP pin/unpin tools**

In `src/mcp/server.ts`, add two new tools:

```typescript
{
  name: 'agenttop_pin_session',
  description: 'Pin a session to the top of the session list',
  inputSchema: {
    type: 'object' as const,
    properties: { sessionId: { type: 'string', description: 'Session ID to pin' } },
    required: ['sessionId'],
  },
},
{
  name: 'agenttop_unpin_session',
  description: 'Unpin a session',
  inputSchema: {
    type: 'object' as const,
    properties: { sessionId: { type: 'string', description: 'Session ID to unpin' } },
    required: ['sessionId'],
  },
},
```

Add handler cases:

```typescript
case 'agenttop_pin_session': {
  const sid = args?.sessionId as string;
  pinSession(sid);
  return { content: [{ type: 'text', text: `Session ${sid} pinned` }] };
}
case 'agenttop_unpin_session': {
  const sid = args?.sessionId as string;
  unpinSession(sid);
  return { content: [{ type: 'text', text: `Session ${sid} unpinned` }] };
}
```

Add `pinned: boolean` to `agenttop_sessions` response.

Import `pinSession`, `unpinSession` from `../config/store.js`.

- [ ] **Step 8: Build and test**

Run: `npm run build && npx vitest run`
Expected: Clean build, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/config/store.ts src/discovery/types.ts src/discovery/sessions.ts src/discovery/sessionsAsync.ts src/ui/components/SessionList.tsx src/ui/hooks/useKeyHandler.ts src/ui/App.tsx src/mcp/server.ts
git commit -m "feat(ui): add session pinning with reordering, pin indicator, and MCP tools"
```

---

## Task 14: Package Distribution Files (renumbered)

**Files:**
- Create: `snap/snapcraft.yaml`
- Create: `flake.nix`
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Create snapcraft.yaml**

```yaml
name: agenttop
version: git
summary: Real-time terminal dashboard for monitoring AI coding agent sessions
description: |
  Like htop for agents. Monitor Claude Code sessions with real-time activity feeds,
  token usage tracking, security alerts, and session management.
base: core22
confinement: classic
grade: stable

apps:
  agenttop:
    command: bin/agenttop
    environment:
      NODE_PATH: $SNAP/lib/node_modules

parts:
  agenttop:
    plugin: npm
    npm-node-version: '20.11.0'
    source: .
```

- [ ] **Step 2: Create flake.nix**

```nix
{
  description = "Real-time terminal dashboard for monitoring AI coding agent sessions";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "agenttop";
          version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
          src = ./.;
          npmDepsHash = "";  # update after first build
          nodejs = pkgs.nodejs_20;
          meta = {
            description = "Real-time terminal dashboard for monitoring AI coding agent sessions";
            license = pkgs.lib.licenses.mit;
            mainProgram = "agenttop";
          };
        };
      }
    );
}
```

- [ ] **Step 3: Create publish.yml**

```yaml
name: Publish to Package Managers

on:
  release:
    types: [published]

jobs:
  homebrew:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update Homebrew formula
        env:
          GH_TOKEN: ${{ secrets.TAP_TOKEN }}
        run: |
          VERSION="${GITHUB_REF#refs/tags/v}"
          gh api repos/wrxck/homebrew-tap/dispatches \
            -f event_type=update-formula \
            -f "client_payload[version]=$VERSION"

  scoop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update Scoop manifest
        env:
          GH_TOKEN: ${{ secrets.SCOOP_TOKEN }}
        run: |
          VERSION="${GITHUB_REF#refs/tags/v}"
          gh api repos/wrxck/scoop-bucket/dispatches \
            -f event_type=update-manifest \
            -f "client_payload[version]=$VERSION"

  snap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snapcore/action-build@v1
        id: snap
      - uses: snapcore/action-publish@v1
        env:
          SNAPCRAFT_STORE_CREDENTIALS: ${{ secrets.SNAP_TOKEN }}
        with:
          snap: ${{ steps.snap.outputs.snap }}
          release: stable

  aur:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update AUR package
        env:
          AUR_SSH_KEY: ${{ secrets.AUR_SSH_KEY }}
        run: |
          VERSION="${GITHUB_REF#refs/tags/v}"
          # AUR update script would go here
          echo "Update PKGBUILD to version $VERSION"

  winget:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - name: Create standalone exe
        run: npx pkg dist/index.js --targets node20-win-x64 --output agenttop.exe
      - name: Submit to winget
        run: |
          # winget manifest submission would go here
          echo "Submit winget manifest for version $env:GITHUB_REF"
```

- [ ] **Step 4: Commit**

```bash
git add snap/snapcraft.yaml flake.nix .github/workflows/publish.yml
git commit -m "chore(dist): add Snap, Nix, and multi-platform publish CI workflow"
```

---

## Task 14: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Update README install section**

After the existing Homebrew section (line 67), add:

```markdown
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

Or add to your flake inputs.

### Snap

```bash
sudo snap install agenttop --classic
```
```

- [ ] **Step 2: Add session status section to README**

After the "Active/inactive indicators" section (line 179), add a new section:

```markdown
## Session status

agenttop detects four session states:

| Status | Indicator | Meaning |
|--------|-----------|---------|
| Waiting | Yellow ● `[waiting]` | Claude has asked a question and is waiting for your input |
| Stale | Orange ● `[stale]` | Process is running but no output for the configured timeout |
| Active | Green ● | Actively processing |
| Inactive | Grey ○ | Process has ended |

Sessions sort by status priority: waiting > stale > active > inactive, then by last activity within each group.

The stale timeout (default 60s) can be adjusted in Settings or the Alert Rules menu.
```

- [ ] **Step 3: Add custom alerts section to README**

After the security rules section:

```markdown
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
```

- [ ] **Step 4: Update themes section**

Update line 208 to reflect new count:

```markdown
agenttop ships with 27 built-in colour themes and a full theme management system.
```

Update the theme list to include the new ones.

- [ ] **Step 5: Update MCP tools table**

Add new tools to the MCP server table (after line 309):

```markdown
| `agenttop_waiting_sessions` | List sessions in waiting or stale state |
| `agenttop_session_status` | Get status for a specific session |
| `agenttop_custom_alerts` | List configured custom alert rules |
| `agenttop_set_custom_alert` | Add or update a custom alert rule |
| `agenttop_delete_custom_alert` | Delete a custom alert rule |
| `agenttop_alert_history` | Get recent alerts with severity filter |
| `agenttop_set_stale_timeout` | Set the stale timeout |
```

- [ ] **Step 6: Update config example**

Add new fields to the config JSON example.

- [ ] **Step 7: Update keybindings table**

Add:
```
| r | Open alert rules menu |
| p | Toggle pin on selected session |
| P | Move pinned session up |
```

- [ ] **Step 8: Update table of contents**

Add entries for new sections.

- [ ] **Step 9: Update CONTRIBUTING.md**

Fix dependencies line:

```markdown
Four runtime deps: `ink`, `react`, `chokidar`, and `@modelcontextprotocol/sdk`. Keep it that way.
```

Update architecture tree to include `config/store.ts`, `config/themes.ts`, `mcp/server.ts`, `analysis/rules/custom.ts`.

Add section on custom rules:

```markdown
## Adding custom alert rules

Users can define custom rules via the config file or TUI — no code changes needed. See [Custom alerts](#custom-alerts) in the README.

For programmatic rules, see the existing rule files in `src/analysis/rules/`.
```

- [ ] **Step 10: Build to verify no markdown issues**

Run: `npm run build`

- [ ] **Step 11: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: update README and CONTRIBUTING for session status, custom alerts, themes, and distribution"
```

---

## Task 15: Final Integration Test

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Verify binary works**

Run: `node dist/index.js --version && node dist/index.js --help`
Expected: Version prints, help shows new options.

- [ ] **Step 5: Fix any issues found**

Address any build, test, or lint failures.

- [ ] **Step 6: Final commit if needed**

```bash
git add -u
git commit -m "fix: address integration issues from final testing"
```
