import path from 'node:path';
import { loadConfig, resolveUsername, ROOT } from './lib/config.mjs';
import { readJson, writeAtomicIfChanged } from './lib/files.mjs';
import { refreshCache } from './lib/refresh.mjs';

const CACHE_PATH = path.join(ROOT, 'assets/cache/github-data.json');
const STATUS_PATH = path.join(ROOT, 'assets/cache/fetch-status.json');
const config = await loadConfig();
const username = resolveUsername(config);
const cache = await readJson(CACHE_PATH, { schemaVersion: 1, username: '', repositories: null, featuredProjects: null, contributions: null });
const result = await refreshCache({
  username,
  featuredRepositories: config.features.featuredProjects ? config.github.featuredRepositories : [],
  cache,
  token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
});
if (result.saveCache) await writeAtomicIfChanged(CACHE_PATH, result.cache);
await writeAtomicIfChanged(STATUS_PATH, result.status);
if (result.warning) console.warn(`GitHub API refresh warning for ${username || 'profile'}${result.rateLimited ? ' (rate limit)' : ''}: ${result.warning}`);
else console.log(result.message);
