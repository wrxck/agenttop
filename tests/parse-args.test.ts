import { describe, it, expect } from 'vitest';

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2);
  const options = {
    allUsers: false,
    noSecurity: false,
    json: false,
    plain: false,
    alertLevel: 'warn' as string,
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
          options.alertLevel = args[i];
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

describe('parseArgs', () => {
  it('returns defaults with no args', () => {
    const opts = parseArgs(['node', 'agenttop']);
    expect(opts.allUsers).toBeFalsy();
    expect(opts.noSecurity).toBeFalsy();
    expect(opts.json).toBeFalsy();
    expect(opts.alertLevel).toBe('warn');
    expect(opts.pollInterval).toBe(10000);
  });

  it('parses boolean flags', () => {
    const opts = parseArgs(['node', 'agenttop', '--all-users', '--no-security', '--json', '--mcp']);
    expect(opts.allUsers).toBeTruthy();
    expect(opts.noSecurity).toBeTruthy();
    expect(opts.json).toBeTruthy();
    expect(opts.mcp).toBeTruthy();
  });

  it('parses --alert-level', () => {
    const opts = parseArgs(['node', 'agenttop', '--alert-level', 'critical']);
    expect(opts.alertLevel).toBe('critical');
  });

  it('ignores invalid alert level', () => {
    const opts = parseArgs(['node', 'agenttop', '--alert-level', 'bogus']);
    expect(opts.alertLevel).toBe('warn');
  });

  it('parses --poll-interval', () => {
    const opts = parseArgs(['node', 'agenttop', '--poll-interval', '5000']);
    expect(opts.pollInterval).toBe(5000);
  });

  it('ignores invalid poll interval', () => {
    const opts = parseArgs(['node', 'agenttop', '--poll-interval', '-1']);
    expect(opts.pollInterval).toBe(10000);
  });

  it('parses --version and --help', () => {
    expect(parseArgs(['node', 'agenttop', '--version']).version).toBeTruthy();
    expect(parseArgs(['node', 'agenttop', '--help']).help).toBeTruthy();
  });

  it('parses hook flags', () => {
    expect(parseArgs(['node', 'agenttop', '--install-hooks']).installHooks).toBeTruthy();
    expect(parseArgs(['node', 'agenttop', '--uninstall-hooks']).uninstallHooks).toBeTruthy();
    expect(parseArgs(['node', 'agenttop', '--install-mcp']).installMcp).toBeTruthy();
  });

  it('handles multiple flags together', () => {
    const opts = parseArgs([
      'node',
      'agenttop',
      '--no-notify',
      '--no-alert-log',
      '--no-updates',
      '--plain',
      '--alert-level',
      'high',
    ]);
    expect(opts.noNotify).toBeTruthy();
    expect(opts.noAlertLog).toBeTruthy();
    expect(opts.noUpdates).toBeTruthy();
    expect(opts.plain).toBeTruthy();
    expect(opts.alertLevel).toBe('high');
  });
});
