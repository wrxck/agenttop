import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const installMcpConfig = (): void => {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    /* empty */
  }
  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers.agenttop = { command: 'agenttop', args: ['--mcp'] };
  settings.mcpServers = mcpServers;
  mkdirSync(join(homedir(), '.claude'), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  process.stdout.write('agenttop MCP server registered in Claude Code settings\n');
  process.stdout.write(`  settings: ${settingsPath}\n`);
};
