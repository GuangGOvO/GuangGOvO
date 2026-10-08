import path from 'node:path';
import { readJson, writeAtomicIfChanged } from './lib/files.mjs';
import { loadConfig, resolveUsername, ROOT } from './lib/config.mjs';
import { updateReadme } from './lib/markdown.mjs';
import {
  loadCache,
  renderFeaturedProjects,
  renderHero,
  renderLogo,
  renderContributionGrid,
  renderSnakePlaceholder,
  renderStats,
  renderStatus,
  renderTechStack,
  writeSvg,
  writeSvgIfMissing
} from './lib/svg.mjs';

const config = await loadConfig();
const username = resolveUsername(config);
const storedCache = await loadCache();
const sameAccount = storedCache.username?.toLowerCase() === username.toLowerCase();
const cache = sameAccount ? storedCache : { schemaVersion: 1, username, repositories: null, featuredProjects: null, contributions: null };
const savedStatus = await readJson(path.join(ROOT, 'assets/cache/fetch-status.json'), { username: '', status: 'unconfigured', sections: {}, updatedAt: null });
const fetchStatus = savedStatus.username?.toLowerCase() === username.toLowerCase() ? savedStatus : { username, status: username ? 'pending' : 'unconfigured', sections: {}, updatedAt: null };

const writes = [
  writeSvg(path.join(ROOT, 'assets/brand/logo-dark.svg'), renderLogo(config, 'dark', config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/brand/logo-light.svg'), renderLogo(config, 'light', config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/brand/logo-dark-static.svg'), renderLogo(config, 'dark', false)),
  writeSvg(path.join(ROOT, 'assets/brand/logo-light-static.svg'), renderLogo(config, 'light', false)),
  writeSvg(path.join(ROOT, 'assets/generated/hero-dark.svg'), renderHero(config, 'dark', config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/hero-light.svg'), renderHero(config, 'light', config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/hero-dark-static.svg'), renderHero(config, 'dark', false)),
  writeSvg(path.join(ROOT, 'assets/generated/hero-light-static.svg'), renderHero(config, 'light', false)),
  writeSvg(path.join(ROOT, 'assets/generated/featured-projects-dark.svg'), renderFeaturedProjects(config, cache.featuredProjects, fetchStatus, 'dark')),
  writeSvg(path.join(ROOT, 'assets/generated/featured-projects-light.svg'), renderFeaturedProjects(config, cache.featuredProjects, fetchStatus, 'light')),
  writeSvg(path.join(ROOT, 'assets/generated/tech-stack-dark.svg'), renderTechStack(config, 'dark')),
  writeSvg(path.join(ROOT, 'assets/generated/tech-stack-light.svg'), renderTechStack(config, 'light')),
  writeSvg(path.join(ROOT, 'assets/generated/profile-status-dark.svg'), renderStatus(config, username, cache, fetchStatus, 'dark', config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/profile-status-light.svg'), renderStatus(config, username, cache, fetchStatus, 'light', config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/profile-status-dark-static.svg'), renderStatus(config, username, cache, fetchStatus, 'dark', false)),
  writeSvg(path.join(ROOT, 'assets/generated/profile-status-light-static.svg'), renderStatus(config, username, cache, fetchStatus, 'light', false)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-dark.svg'), renderStats(config, cache, 'dark', fetchStatus, config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-light.svg'), renderStats(config, cache, 'light', fetchStatus, config.features.animations)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-dark-static.svg'), renderStats(config, cache, 'dark', fetchStatus, false)),
  writeSvg(path.join(ROOT, 'assets/generated/github-stats-light-static.svg'), renderStats(config, cache, 'light', fetchStatus, false)),
  writeSvg(path.join(ROOT, 'assets/generated/contribution-grid-dark.svg'), renderContributionGrid(config, cache.contributions, 'dark')),
  writeSvg(path.join(ROOT, 'assets/generated/contribution-grid-light.svg'), renderContributionGrid(config, cache.contributions, 'light')),
  writeSvgIfMissing(path.join(ROOT, 'assets/generated/contribution-snake-dark.svg'), renderSnakePlaceholder(config, 'dark')),
  writeSvgIfMissing(path.join(ROOT, 'assets/generated/contribution-snake-light.svg'), renderSnakePlaceholder(config, 'light'))
];
await Promise.all(writes);
await updateReadme(config, { cache, username });
console.log(`Generated profile assets for ${username || 'an unconfigured profile'}.`);
