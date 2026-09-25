// Cross-platform test runner: runs every src/**/*.test.ts in the current package with tsx.
// Replaces `bash -c 'node --test $(find ...)'`, which fails under Windows npm (cmd.exe).
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function findTests(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') found.push(...findTests(full));
    } else if (entry.endsWith('.test.ts')) {
      found.push(full);
    }
  }
  return found;
}

const files = findTests('src').sort();
if (files.length === 0) {
  console.log('No test files found under src/');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
