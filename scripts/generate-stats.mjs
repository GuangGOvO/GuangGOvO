import path from 'node:path';
import { loadConfig, resolveUsername, ROOT } from './lib/config.mjs';
import { readJson } from './lib/files.mjs';
import { updateReadme } from './lib/markdown.mjs';
import { loadCache, renderContributionGrid, renderStats, writeSvg } from './lib/svg.mjs';

const config = await loadConfig();
const username = resolveUsername(config);
const storedCache = await loadCache();
const cache = storedCache.username?.toLowerCase() === username.toLowerCase()
  ? storedCache
  : { schemaVersion: 1, username, repositories: null, featuredProjects: null, contributions: null };
const savedStatus = await readJson(path.join(ROOT, 'assets/cache/fetch-status.json'), { username: '', sections: {} });
const status = savedStatus.username?.toLowerCase() === username.toLowerCase() ? savedStatus : { username, sections: {} };

await Promise.all([
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-dark.svg'), renderStats(config, cache, 'dark', status, config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-light.svg'), renderStats(config, cache, 'light', status, config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-dark-static.svg'), renderStats(config, cache, 'dark', status, false)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-light-static.svg'), renderStats(config, cache, 'light', status, false)),
  writeSvg(path.join(ROOT, 'assets/generated/contribution-grid-dark.svg'), renderContributionGrid(config, cache.contributions, 'dark')),
  writeSvg(path.join(ROOT, 'assets/generated/contribution-grid-light.svg'), renderContributionGrid(config, cache.contributions, 'light'))
]);
await updateReadme(config, { cache, username });
console.log(`Generated public analytics for ${username || 'an unconfigured profile'}.`);
