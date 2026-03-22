import { startMcpServer } from './mcp/server.js';

const allUsers = process.argv.includes('--all-users');
const noSecurity = process.argv.includes('--no-security');

startMcpServer(allUsers, noSecurity).catch((err) => {
  process.stderr.write(`agenttop mcp server error: ${err}\n`);
  process.exit(1);
});
