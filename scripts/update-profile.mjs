import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './lib/config.mjs';

const node = process.execPath;
for (const script of ['fetch-github-data.mjs', 'generate-assets.mjs', 'validate-assets.mjs']) {
  const result = spawnSync(node, [path.join(ROOT, 'scripts', script)], { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Profile refresh and validation completed.');
