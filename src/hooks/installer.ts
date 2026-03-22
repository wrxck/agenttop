import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK_FILENAME = 'agenttop-guard.py';
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

const getHookSource = (): string => {
  const thisFile = fileURLToPath(import.meta.url);
  const srcHooksDir = join(dirname(thisFile), '..', 'src', 'hooks');
  const distHooksDir = join(dirname(thisFile), 'hooks');

  for (const dir of [distHooksDir, srcHooksDir]) {
    const path = join(dir, HOOK_FILENAME);
    if (existsSync(path)) return path;
  }

  const npmGlobalPath = join(dirname(thisFile), '..', 'hooks', HOOK_FILENAME);
  if (existsSync(npmGlobalPath)) return npmGlobalPath;

  throw new Error(`cannot find ${HOOK_FILENAME} — is agenttop installed correctly?`);
};

const getHookTarget = (): string => {
  const claudeHooksDir = join(homedir(), '.claude', 'hooks');
  mkdirSync(claudeHooksDir, { recursive: true });
  return join(claudeHooksDir, HOOK_FILENAME);
};

interface HookEntry {
  type: string;
  command: string;
}

interface MatcherEntry {
  matcher: string;
  hooks: HookEntry[];
}

const readSettings = (): Record<string, unknown> => {
  if (!existsSync(SETTINGS_PATH)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
};

const writeSettings = (settings: Record<string, unknown>): void => {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
};

export const installHooks = (): void => {
  const source = getHookSource();
  const target = getHookTarget();

  copyFileSync(source, target);
  chmodSync(target, 0o755);

  const settings = readSettings();
  const hooks = (settings.hooks ?? {}) as Record<string, MatcherEntry[]>;

  const postToolUse = hooks.PostToolUse ?? [];
  const hookCommand = target;

  const allToolsMatcher = postToolUse.find(
    (entry: MatcherEntry) => entry.matcher === 'Bash|Read|Grep|Glob|WebFetch|WebSearch',
  );

  if (allToolsMatcher) {
    const alreadyInstalled = allToolsMatcher.hooks.some(
      (h: HookEntry) => h.command.includes('agenttop-guard'),
    );
    if (alreadyInstalled) {
      process.stdout.write('agenttop hooks already installed\n');
      return;
    }
    allToolsMatcher.hooks.push({ type: 'command', command: hookCommand });
  } else {
    postToolUse.push({
      matcher: 'Bash|Read|Grep|Glob|WebFetch|WebSearch',
      hooks: [{ type: 'command', command: hookCommand }],
    });
  }

  hooks.PostToolUse = postToolUse;
  settings.hooks = hooks;
  writeSettings(settings);

  process.stdout.write(`agenttop hooks installed:\n`);
  process.stdout.write(`  hook: ${target}\n`);
  process.stdout.write(`  settings: ${SETTINGS_PATH}\n`);
  process.stdout.write(`  matcher: PostToolUse (Bash|Read|Grep|Glob|WebFetch|WebSearch)\n`);
};

export const uninstallHooks = (): void => {
  const settings = readSettings();
  const hooks = (settings.hooks ?? {}) as Record<string, MatcherEntry[]>;
  const postToolUse = hooks.PostToolUse ?? [];

  let removed = false;
  for (const entry of postToolUse) {
    const before = entry.hooks.length;
    entry.hooks = entry.hooks.filter((h: HookEntry) => !h.command.includes('agenttop-guard'));
    if (entry.hooks.length < before) removed = true;
  }

  hooks.PostToolUse = postToolUse.filter((e: MatcherEntry) => e.hooks.length > 0);
  settings.hooks = hooks;
  writeSettings(settings);

  if (removed) {
    process.stdout.write('agenttop hooks removed from Claude Code settings\n');
  } else {
    process.stdout.write('agenttop hooks were not installed\n');
  }
};
