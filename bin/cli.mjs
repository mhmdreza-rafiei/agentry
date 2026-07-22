#!/usr/bin/env node
// Dev shim — the published package uses dist/cli.mjs (built by obuild).
import('../dist/cli.mjs').catch(async () => {
  // Fallback to tsx for dev when dist is not built.
  const { spawnSync } = await import('node:child_process');
  const args = process.argv.slice(2);
  const res = spawnSync('npx', ['tsx', 'src/cli.ts', ...args], { stdio: 'inherit' });
  process.exit(res.status ?? 1);
});
