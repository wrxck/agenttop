# Contributing to agenttop

Contributions are welcome. This document covers the process and standards expected.

## Getting started

```bash
git clone https://github.com/wrxck/agenttop.git
cd agenttop
npm install
npm run build
```

Run locally:

```bash
node dist/index.js
```

## Development workflow

1. Fork the repo and clone your fork
2. Create a feature branch from `main`: `git checkout -b feat/my-feature main`
3. Make your changes
4. Build and verify: `npm run build && node dist/index.js --version`
5. Push and open a PR targeting `main`

### Branch model

- **main** — primary branch, all PRs target here
- **feat/\***, **fix/\***, **chore/\*** — working branches

## Code standards

### TypeScript

- Strict mode enabled
- ESM only (`"type": "module"`)
- Named exports preferred over default exports
- No `any` types — use `unknown` and narrow
- Imports ordered: node built-ins, external packages, internal modules (separated by blank lines)

### Commits

Use [conventional commits](https://www.conventionalcommits.org/):

```
type(scope): lowercase description
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

Examples:

```
feat(ui): add session filtering
fix(discovery): handle missing output files
chore(deps): update chokidar to 4.1.0
```

### Style

- No emojis in code or commits
- Comments in lowercase, British English spelling, only when necessary
- Keep functions small and focused
- No over-engineering — solve the current problem, not hypothetical future ones

## Adding security rules

Security rules live in `src/analysis/rules/`. Each rule is a pure function:

```typescript
(event: SecurityEvent) => Alert | null
```

To add a new rule:

1. Create a new file in `src/analysis/rules/`
2. Export a function matching the signature above
3. Register it in `src/analysis/security.ts`
4. If it should also work in the active hook, add patterns to `src/hooks/agenttop-guard.py`

## Custom alert rules

For rules that don't need code changes, users can define custom alert rules via the config file or the Alert Rules menu (`r` in the TUI). Custom rules use regex patterns matched against tool input, output, tool name, or all fields. See the [Custom alerts](README.md#custom-alerts) section in the README for configuration details.

When adding built-in security rules, follow the existing pattern in `src/analysis/rules/`. Custom rules are the preferred path for user-specific or project-specific alerts.

## Pull request checklist

- [ ] Branch created from `main`
- [ ] PR targets `main`
- [ ] `npm run build` succeeds
- [ ] `node dist/index.js --version` works
- [ ] `node dist/index.js --help` works
- [ ] Conventional commit messages
- [ ] No unrelated changes
- [ ] CI passes

## Architecture

```
src/
  index.tsx              CLI entry, arg parsing, Ink render
  config.ts              Path resolution, platform detection
  discovery/
    types.ts             All shared types
    sessions.ts          Session discovery from /tmp + ps
  ingestion/
    tail.ts              Seek-based file tailing
    parser.ts            JSONL -> ToolCall + ToolResult
    watcher.ts           Chokidar file watcher
  config/
    store.ts             Config persistence and defaults
    themes.ts            Built-in theme definitions
  analysis/
    security.ts          Rule engine
    rules/               One file per rule category
    rules/custom.ts      User-defined alert rules
  mcp/
    server.ts            MCP server implementation
  hooks/
    agenttop-guard.py    Claude Code PostToolUse hook
    installer.ts         --install-hooks / --uninstall-hooks
  ui/
    App.tsx              Root layout, keyboard handling
    theme.ts             Colours
    components/          Ink components
    hooks/               React hooks for state
```

## Dependencies

Four runtime deps: `ink`, `react`, `chokidar`, and `@modelcontextprotocol/sdk`. Keep it lean. If you need something, check if Node built-ins cover it first.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
