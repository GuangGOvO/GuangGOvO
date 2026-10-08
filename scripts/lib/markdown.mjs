import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './config.mjs';
import { writeAtomicIfChanged } from './files.mjs';

export async function updateReadme(config, data = {}) {
  const readmePath = path.join(ROOT, 'README.md');
  const username = data.username || config.github.username || process.env.GITHUB_REPOSITORY_OWNER || '';
  const cache = data.cache ?? { username: '', repositories: null, featuredProjects: null, contributions: null };
  const projectMap = new Map((cache.username?.toLowerCase() === username.toLowerCase() ? cache.featuredProjects ?? [] : []).map((repo) => [repo.fullName.toLowerCase(), repo]));
  let markdown = await readFile(readmePath, 'utf8');
  const blocks = {
    brand: `<strong>${escapeHtml(config.brand.name)}</strong>`,
    hero: renderHeroBlock(config),
    about: renderAboutBlock(config),
    stack: renderStackBlock(config),
    projects: renderProjectsBlock(config, projectMap),
    analytics: renderAnalyticsBlock(config),
    snake: renderSnakeBlock(config),
    connect: renderConnectBlock(config, username)
  };
  for (const [name, content] of Object.entries(blocks)) markdown = replaceGeneratedBlock(markdown, name, content);
  await writeAtomicIfChanged(readmePath, markdown);
}

function replaceGeneratedBlock(markdown, name, content) {
  const start = `<!-- profile:${name}:start -->`;
  const end = `<!-- profile:${name}:end -->`;
  const startCount = markdown.split(start).length - 1;
  const endCount = markdown.split(end).length - 1;
  if (startCount !== 1 || endCount !== 1) throw new Error(`README.md must contain exactly one ${start} and ${end} marker pair.`);
  const startIndex = markdown.indexOf(start) + start.length;
  const endIndex = markdown.indexOf(end);
  if (endIndex < startIndex) throw new Error(`README.md has reversed markers for ${name}.`);
  return `${markdown.slice(0, startIndex)}\n${content.trim()}\n${markdown.slice(endIndex)}`;
}

function renderHeroBlock(config) {
  const animations = config.features.animations;
  return `<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="assets/generated/hero-dark-static.svg" />
    <source media="(prefers-reduced-motion: reduce)" srcset="assets/generated/hero-light-static.svg" />
    <source media="(prefers-color-scheme: dark)" srcset="assets/generated/${animations ? 'hero-dark.svg' : 'hero-dark-static.svg'}" />
    <img src="assets/generated/${animations ? 'hero-light.svg' : 'hero-light-static.svg'}" alt="Terminal welcome banner" width="960" />
  </picture>
</p>`;
}

function renderAboutBlock(config) {
  const identity = config.identity;
  const lines = [];
  if (identity.publicName) lines.push(`**${md(identity.publicName)}**`);
  if (identity.headline) lines.push(md(identity.headline));
  if (identity.bio) lines.push(md(identity.bio));
  if (identity.interests.length) lines.push(`- **Interests:** ${identity.interests.map(md).join(' · ')}`);
  if (identity.currentResearch.length) lines.push(`- **Current research:** ${identity.currentResearch.map(md).join(' · ')}`);
  if (!lines.length) lines.push('_Profile details are intentionally unconfigured. Add only information you want to share publicly in `profile.config.json`._');
  lines.push('', `<picture>\n  <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="assets/generated/profile-status-dark-static.svg" />\n  <source media="(prefers-reduced-motion: reduce)" srcset="assets/generated/profile-status-light-static.svg" />\n  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/profile-status-dark.svg" />\n  <img src="assets/generated/profile-status-light.svg" alt="Profile data refresh status" width="960" />\n</picture>`);
  return lines.join('\n');
}

function renderStackBlock(config) {
  return `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/tech-stack-dark.svg" />\n  <img src="assets/generated/tech-stack-light.svg" alt="Configured technology stack" width="960" />\n</picture>`;
}

function renderProjectsBlock(config, projectMap) {
  if (!config.features.featuredProjects) return '_Featured projects are disabled in `profile.config.json`._';
  const lines = [`<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/featured-projects-dark.svg" />\n  <img src="assets/generated/featured-projects-light.svg" alt="Featured public repositories" width="960" />\n</picture>`];
  for (const fullName of config.github.featuredRepositories) {
    const repo = projectMap.get(fullName.toLowerCase());
    const suffix = repo ? ` — ${md(repo.language || 'language not reported')} · ★ ${Number.isSafeInteger(repo.stars) ? repo.stars : 0}` : '';
    lines.push(`- [${md(fullName)}](https://github.com/${fullName})${suffix}`);
  }
  if (!config.github.featuredRepositories.length) lines.push('', '_Choose up to six real public repositories in `profile.config.json`._');
  return lines.join('\n');
}

function renderAnalyticsBlock(config) {
  if (!config.features.githubStats) return '_GitHub analytics are disabled in `profile.config.json`._';
  return `<picture>
  <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="assets/generated/github-stats-dark-static.svg" />
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/generated/github-stats-light-static.svg" />
  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/github-stats-dark.svg" />
  <img src="assets/generated/github-stats-light.svg" alt="Public repository statistics" width="960" />
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/contribution-grid-dark.svg" />
  <img src="assets/generated/contribution-grid-light.svg" alt="Public contribution calendar for the past 365 days" width="960" />
</picture>

_Contribution total follows GitHub's public contribution calendar; languages are ranked by each repository's primary language._`;
}

function renderSnakeBlock(config) {
  if (!config.features.contributionSnake) return '_The contribution snake is disabled in `profile.config.json`._';
  return `<picture>
  <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="assets/generated/contribution-grid-dark.svg" />
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/generated/contribution-grid-light.svg" />
  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/contribution-snake-dark.svg" />
  <img src="assets/generated/contribution-snake-light.svg" alt="Animated snake built from the public contribution calendar" width="960" />
</picture>

_If the animation has not been generated yet, this image shows a static setup message._`;
}

function renderConnectBlock(config, username) {
  const links = [];
  if (config.identity.website) links.push(`[Personal website](${markdownUrl(config.identity.website)})`);
  if (username) links.push(`[GitHub repositories](https://github.com/${encodeURIComponent(username)}?tab=repositories)`);
  if (config.identity.contact) links.push(`[Contact](${markdownUrl(config.identity.contact)})`);
  if (config.identity.blog) links.push(`[Blog](${markdownUrl(config.identity.blog)})`);
  return links.length ? links.map((link) => `- ${link}`).join('\n') : '_Add a website, contact link, or blog to `profile.config.json` when you are ready to publish it._';
}

function md(value) {
  return String(value ?? '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1').replace(/[\r\n]+/g, ' ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function markdownUrl(value) {
  return new URL(value).href.replace(/\(/g, '%28').replace(/\)/g, '%29');
}
