import { fetchProfileData, GitHubApiError } from './github.mjs';

export async function refreshCache({ username, featuredRepositories, cache, token = '', fetchImpl, now = new Date() }) {
  if (!username) {
    return {
      cache,
      saveCache: false,
      status: { username: '', status: 'unconfigured', sections: {}, updatedAt: now.toISOString() },
      message: 'No GitHub username is configured or available from the workflow context; no API request was made.'
    };
  }

  const sameAccount = cache.username?.toLowerCase() === username.toLowerCase();
  const nextCache = sameAccount ? structuredClone(cache) : { schemaVersion: 1, username, repositories: null, featuredProjects: null, contributions: null };
  try {
    const result = await fetchProfileData({ username, featuredRepositories, token, fetchImpl, now });
    nextCache.username = username;
    nextCache.repositories = result.repositories;
    nextCache.featuredProjects = result.featuredProjects;
    if (result.contributions) nextCache.contributions = result.contributions;
    const sections = {
      repositories: 'fresh',
      featuredProjects: featuredRepositories.length ? 'fresh' : 'empty',
      contributions: result.contributions ? 'fresh' : nextCache.contributions ? 'cached' : 'error'
    };
    const status = {
      username,
      status: Object.values(sections).includes('error') ? 'partial' : 'ok',
      sections,
      messages: result.contributionError ? { contributions: result.contributionError.message } : {},
      updatedAt: now.toISOString()
    };
    return {
      cache: nextCache,
      saveCache: true,
      status,
      message: `Fetched public repository data for ${username}; contributions: ${sections.contributions}.`,
      warning: result.contributionError?.message
    };
  } catch (error) {
    const rateLimited = error instanceof GitHubApiError && error.rateLimited;
    const message = error instanceof Error ? error.message : 'Unknown GitHub API error';
    const sections = {
      repositories: nextCache.repositories ? 'cached' : 'error',
      featuredProjects: featuredRepositories.length === 0 ? 'empty' : nextCache.featuredProjects?.length ? 'cached' : 'error',
      contributions: nextCache.contributions ? 'cached' : 'error'
    };
    return {
      cache,
      saveCache: false,
      status: {
        username,
        status: 'error',
        sections,
        rateLimited,
        messages: { request: message },
        updatedAt: now.toISOString()
      },
      warning: `${message} The existing cache and generated SVG cards have been retained.`,
      rateLimited
    };
  }
}
