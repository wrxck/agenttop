module.exports = {
  entry: ['src/index.tsx', 'src/mcp-server.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
  external: ['react', 'ink'],
};
