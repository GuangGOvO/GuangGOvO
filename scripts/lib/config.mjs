import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONFIG_PATH = path.join(ROOT, 'profile.config.json');

export async function loadConfig(filePath = CONFIG_PATH) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read profile configuration at ${filePath}: ${error.message}`);
  }
  validateConfig(parsed);
  return parsed;
}

export function validateConfig(config) {
  const errors = [];
  const object = (value, pathName, required) => {
    if (!isRecord(value)) {
      errors.push(`${pathName} must be an object`);
      return false;
    }
    for (const key of Object.keys(value)) if (!required.includes(key)) errors.push(`${pathName}.${key} is not supported`);
    for (const key of required) if (!(key in value)) errors.push(`${pathName}.${key} is required`);
    return true;
  };
  const string = (value, pathName, maxLength, { allowEmpty = true, pattern } = {}) => {
    if (typeof value !== 'string') errors.push(`${pathName} must be a string`);
    else {
      if (!allowEmpty && value.length === 0) errors.push(`${pathName} must not be empty`);
      if (value.length > maxLength) errors.push(`${pathName} must be at most ${maxLength} characters`);
      if (pattern && value !== '' && !pattern.test(value)) errors.push(`${pathName} has an invalid format`);
    }
  };
  const list = (value, pathName, maxItems, itemMaxLength, { minLength = 0 } = {}) => {
    if (!Array.isArray(value)) {
      errors.push(`${pathName} must be an array`);
      return;
    }
    if (value.length > maxItems) errors.push(`${pathName} may contain at most ${maxItems} items`);
    for (const [index, item] of value.entries()) {
      string(item, `${pathName}[${index}]`, itemMaxLength, { allowEmpty: minLength === 0 });
      if (typeof item === 'string' && item.length < minLength) errors.push(`${pathName}[${index}] must have at least ${minLength} characters`);
    }
  };

  if (!object(config, 'config', ['schemaVersion', 'github', 'identity', 'hero', 'technologyStack', 'brand', 'features', 'updates'])) return errors;
  if (config.schemaVersion !== 1) errors.push('schemaVersion must equal 1');

  if (object(config.github, 'github', ['username', 'featuredRepositories'])) {
    string(config.github.username, 'github.username', 39, { pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/ });
    list(config.github.featuredRepositories, 'github.featuredRepositories', 6, 140, { minLength: 3 });
    if (Array.isArray(config.github.featuredRepositories)) {
      const seen = new Set();
      for (const [index, repo] of config.github.featuredRepositories.entries()) {
        if (typeof repo === 'string' && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/.test(repo)) errors.push(`github.featuredRepositories[${index}] must use owner/repository format`);
        if (typeof repo === 'string' && seen.has(repo.toLowerCase())) errors.push(`github.featuredRepositories contains duplicate repository ${repo}`);
        if (typeof repo === 'string') seen.add(repo.toLowerCase());
      }
    }
  }

  if (object(config.identity, 'identity', ['publicName', 'headline', 'bio', 'interests', 'currentResearch', 'website', 'contact', 'blog'])) {
    string(config.identity.publicName, 'identity.publicName', 80);
    string(config.identity.headline, 'identity.headline', 120);
    string(config.identity.bio, 'identity.bio', 500);
    list(config.identity.interests, 'identity.interests', 12, 80);
    list(config.identity.currentResearch, 'identity.currentResearch', 8, 120);
    for (const field of ['website', 'blog']) validateUrl(config.identity[field], `identity.${field}`, errors, ['https:']);
    validateUrl(config.identity.contact, 'identity.contact', errors, ['https:', 'mailto:']);
  }

  if (object(config.hero, 'hero', ['tagline', 'typewriterLines'])) {
    string(config.hero.tagline, 'hero.tagline', 180);
    list(config.hero.typewriterLines, 'hero.typewriterLines', 4, 80, { minLength: 1 });
  }

  const technologyCategories = ['Languages', 'Frontend', 'Backend', 'Mobile', 'Embedded / IoT', 'DevOps / Linux', 'Tools'];
  if (object(config.technologyStack, 'technologyStack', technologyCategories)) {
    for (const category of technologyCategories) list(config.technologyStack[category], `technologyStack.${category}`, 12, 40, { minLength: 1 });
  }

  if (object(config.brand, 'brand', ['name', 'mark', 'colors'])) {
    string(config.brand.name, 'brand.name', 60, { allowEmpty: false });
    string(config.brand.mark, 'brand.mark', 4, { allowEmpty: false });
    if (object(config.brand.colors, 'brand.colors', ['dark', 'light'])) {
      const paletteKeys = ['background', 'panel', 'border', 'text', 'muted', 'green', 'blue', 'amber'];
      for (const theme of ['dark', 'light']) {
        if (object(config.brand.colors[theme], `brand.colors.${theme}`, paletteKeys)) {
          for (const key of paletteKeys) string(config.brand.colors[theme][key], `brand.colors.${theme}.${key}`, 7, { allowEmpty: false, pattern: /^#[0-9A-Fa-f]{6}$/ });
        }
      }
    }
  }

  if (object(config.features, 'features', ['animations', 'featuredProjects', 'githubStats', 'contributionSnake'])) {
    for (const key of ['animations', 'featuredProjects', 'githubStats', 'contributionSnake']) if (typeof config.features[key] !== 'boolean') errors.push(`features.${key} must be a boolean`);
  }

  if (object(config.updates, 'updates', ['frequency', 'baseTimeUtc'])) {
    if (config.updates.frequency !== 'daily') errors.push('updates.frequency must be "daily"');
    string(config.updates.baseTimeUtc, 'updates.baseTimeUtc', 5, { allowEmpty: false, pattern: /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/ });
  }

  if (errors.length) throw new Error(`Invalid profile.config.json:\n- ${errors.join('\n- ')}`);
  return true;
}

export function resolveUsername(config, env = process.env) {
  const username = config.github.username || env.GITHUB_REPOSITORY_OWNER || env.PROFILE_GITHUB_USERNAME || '';
  if (!username) return '';
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)) throw new Error('Resolved GitHub username has an invalid format.');
  return username;
}

function validateUrl(value, pathName, errors, protocols) {
  if (typeof value !== 'string') {
    errors.push(`${pathName} must be a string`);
    return;
  }
  if (!value) return;
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) errors.push(`${pathName} must use ${protocols.join(' or ')}`);
    if (url.username || url.password) errors.push(`${pathName} must not include embedded credentials`);
    if (url.protocol === 'mailto:' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname)) errors.push(`${pathName} must be a valid mailto link`);
  } catch {
    errors.push(`${pathName} must be a valid URL`);
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
