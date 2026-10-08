const API_BASE = 'https://api.github.com';
const GRAPHQL_URL = `${API_BASE}/graphql`;
const API_VERSION = '2026-03-10';
const PAGE_SIZE = 100;
const MAX_REPOSITORY_PAGES = 20;

export class GitHubApiError extends Error {
  constructor(message, { status = 0, rateLimited = false } = {}) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

export async function fetchProfileData({ username, featuredRepositories = [], token = '', fetchImpl = globalThis.fetch, now = new Date() }) {
  if (!username) throw new Error('A GitHub username is required to fetch profile data.');
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'github-profile-terminal-workspace'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const profile = await requestJson(`${API_BASE}/users/${encodeURIComponent(username)}`, { headers, fetchImpl });
  if (profile.login?.toLowerCase() !== username.toLowerCase()) throw new GitHubApiError('GitHub returned a different account than the configured username.');

  const repositories = [];
  let page = 1;
  while (page <= MAX_REPOSITORY_PAGES) {
    const url = new URL(`${API_BASE}/users/${encodeURIComponent(username)}/repos`);
    url.searchParams.set('type', 'owner');
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    const batch = await requestJson(url, { headers, fetchImpl });
    if (!Array.isArray(batch)) throw new GitHubApiError('GitHub returned an invalid repository list.');
    repositories.push(...batch.filter((repo) => repo.owner?.login?.toLowerCase() === username.toLowerCase()));
    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }

  const publicRepositoryCount = Number.isInteger(profile.public_repos) ? profile.public_repos : repositories.length;
  const complete = repositories.length >= publicRepositoryCount || repositories.length < PAGE_SIZE;
  const languageCounts = new Map();
  for (const repo of repositories) {
    if (typeof repo.language === 'string' && repo.language) languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
  }
  const languages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name, repositoryCount]) => ({ name, repositoryCount }));

  const repoByName = new Map(repositories.map((repo) => [repo.full_name?.toLowerCase(), repo]));
  const featured = [];
  for (const fullName of featuredRepositories) {
    const existing = repoByName.get(fullName.toLowerCase());
    const repo = existing ?? await requestJson(`${API_BASE}/repos/${fullName.split('/').map(encodeURIComponent).join('/')}`, { headers, fetchImpl });
    featured.push(normalizeRepository(repo, fullName));
  }

  const rangeTo = new Date(now);
  rangeTo.setUTCHours(23, 59, 59, 999);
  const rangeFrom = new Date(rangeTo.getTime() - 365 * 24 * 60 * 60 * 1000);
  let contributions = null;
  try {
    const graphqlHeaders = { ...headers, 'Content-Type': 'application/json' };
    const response = await requestJson(GRAPHQL_URL, {
      method: 'POST',
      headers: graphqlHeaders,
      body: JSON.stringify({
        query: `query ProfileContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {\n          user(login: $login) {\n            contributionsCollection(from: $from, to: $to) {\n              contributionCalendar {\n                totalContributions\n                weeks { contributionDays { date contributionCount contributionLevel } }\n              }\n            }\n          }\n        }`,
        variables: { login: username, from: rangeFrom.toISOString(), to: rangeTo.toISOString() }
      }),
      fetchImpl
    });
    if (response.errors?.length) {
      throw new GitHubApiError(`GitHub GraphQL request failed: ${compactError(response.errors[0]?.message)}`);
    }
    const calendar = response.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar || !Number.isInteger(calendar.totalContributions) || !Array.isArray(calendar.weeks)) {
      throw new GitHubApiError('GitHub returned an incomplete contribution calendar.');
    }
    contributions = {
      total: calendar.totalContributions,
      from: rangeFrom.toISOString().slice(0, 10),
      to: rangeTo.toISOString().slice(0, 10),
      weeks: calendar.weeks
    };
  } catch (error) {
    if (!(error instanceof GitHubApiError)) throw error;
    contributions = { error: error.message, rateLimited: error.rateLimited };
  }

  return {
    repositories: {
      publicRepositoryCount,
      repositoriesScanned: repositories.length,
      totalStars: repositories.reduce((sum, repo) => sum + (Number.isSafeInteger(repo.stargazers_count) ? repo.stargazers_count : 0), 0),
      complete,
      languages,
      fetchedAt: now.toISOString()
    },
    featuredProjects: featured,
    contributions: contributions && !contributions.error ? { ...contributions, fetchedAt: now.toISOString() } : null,
    contributionError: contributions?.error ? { message: contributions.error, rateLimited: contributions.rateLimited } : null
  };
}

export async function requestJson(url, { method = 'GET', headers = {}, body, fetchImpl = globalThis.fetch, maxRetries = 2, timeoutMs = 15_000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException('GitHub API request timed out', 'TimeoutError')), timeoutMs);
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxRetries && isTransientNetworkError(error)) {
        await pause(250 * (2 ** attempt));
        continue;
      }
      throw new GitHubApiError(`GitHub API network request failed: ${error.name === 'TimeoutError' ? 'request timed out' : 'connection error'}`);
    }
    clearTimeout(timeout);

    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new GitHubApiError('GitHub API returned invalid JSON.', { status: response.status });
      }
    }

    const remaining = response.headers.get('x-ratelimit-remaining');
    const rateLimited = response.status === 429 || (response.status === 403 && remaining === '0');
    const retryAfter = Number(response.headers.get('retry-after'));
    if (rateLimited) {
      throw new GitHubApiError(retryAfter > 0 ? `GitHub API rate limit reached; retry after ${Math.ceil(retryAfter)} seconds.` : 'GitHub API rate limit reached.', { status: response.status, rateLimited: true });
    }
    if (response.status >= 500 && attempt < maxRetries) {
      await pause(250 * (2 ** attempt));
      continue;
    }
    const label = response.status === 401 || response.status === 403
      ? 'authentication or access was rejected'
      : response.status === 404
        ? 'the requested public resource was not found'
        : `request failed with HTTP ${response.status}`;
    throw new GitHubApiError(`GitHub API ${label}.`, { status: response.status });
  }
  throw new GitHubApiError('GitHub API request did not complete.');
}

function normalizeRepository(repo, expectedName) {
  const fullName = typeof repo.full_name === 'string' ? repo.full_name : expectedName;
  const htmlUrl = `https://github.com/${fullName}`;
  return {
    fullName,
    name: typeof repo.name === 'string' ? repo.name.slice(0, 100) : expectedName.split('/')[1],
    description: typeof repo.description === 'string' ? repo.description.slice(0, 300) : '',
    language: typeof repo.language === 'string' ? repo.language.slice(0, 40) : '',
    stars: Number.isSafeInteger(repo.stargazers_count) ? repo.stargazers_count : 0,
    archived: repo.archived === true,
    htmlUrl
  };
}

function compactError(message) {
  return String(message ?? 'unknown API error').replace(/[\r\n\t]+/g, ' ').slice(0, 160);
}

function isTransientNetworkError(error) {
  return error?.name === 'TimeoutError' || error?.name === 'TypeError';
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
