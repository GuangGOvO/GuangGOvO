import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, validateConfig } from '../scripts/lib/config.mjs';
import { fetchProfileData, GitHubApiError, requestJson } from '../scripts/lib/github.mjs';
import { refreshCache } from '../scripts/lib/refresh.mjs';
import { writeAtomicIfChanged } from '../scripts/lib/files.mjs';
import { renderFeaturedProjects, xml } from '../scripts/lib/svg.mjs';

const config = await loadConfig();

test('configured public account validates without asserting additional personal details', () => {
  assert.equal(config.github.username, 'GuangGOvO');
  assert.deepEqual(config.github.featuredRepositories, []);
  assert.equal(validateConfig(config), true);
});

test('configuration rejects unknown keys, invalid links, and malformed colors', () => {
  const extra = structuredClone(config);
  extra.identity.age = 21;
  assert.throws(() => validateConfig(extra), /identity\.age is not supported/);

  const unsafe = structuredClone(config);
  unsafe.identity.website = 'javascript:alert(1)';
  assert.throws(() => validateConfig(unsafe), /identity\.website must use https:/);

  const badColor = structuredClone(config);
  badColor.brand.colors.dark.background = 'red';
  assert.throws(() => validateConfig(badColor), /brand\.colors\.dark\.background has an invalid format/);
});

test('XML text escaping removes forbidden control characters', () => {
  assert.equal(xml('A&B <tag> "x"\u0000'), 'A&amp;B &lt;tag&gt; &quot;x&quot;');
});

test('GitHub API retrieval aggregates real public repository fields and contribution calendar', async () => {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.pathname === '/users/demo') {
      return jsonResponse({ login: 'demo', public_repos: 1 });
    }
    if (url.pathname === '/users/demo/repos') {
      return jsonResponse([{
        full_name: 'demo/tool', name: 'tool', description: 'A <useful> tool', language: 'TypeScript',
        stargazers_count: 7, archived: false, owner: { login: 'demo' }
      }]);
    }
    if (url.pathname === '/graphql') {
      const body = JSON.parse(init.body);
      assert.equal(body.variables.login, 'demo');
      return jsonResponse({ data: { user: { contributionsCollection: { contributionCalendar: {
        totalContributions: 12,
        weeks: [{ contributionDays: [{ date: '2026-10-01', contributionCount: 2, contributionLevel: 'SECOND_QUARTILE' }] }]
      } } } } });
    }
    throw new Error(`Unexpected API call: ${url}`);
  };

  const result = await fetchProfileData({
    username: 'demo',
    featuredRepositories: ['demo/tool'],
    fetchImpl,
    now: new Date('2026-10-08T12:00:00.000Z')
  });
  assert.equal(result.repositories.publicRepositoryCount, 1);
  assert.equal(result.repositories.totalStars, 7);
  assert.deepEqual(result.repositories.languages, [{ name: 'TypeScript', repositoryCount: 1 }]);
  assert.equal(result.featuredProjects[0].htmlUrl, 'https://github.com/demo/tool');
  assert.equal(result.contributions.total, 12);
  assert.ok(calls.some((call) => call.init.headers['X-GitHub-Api-Version'] === '2026-03-10'));
});

test('rate-limit responses are classified and do not replace a valid cache', async () => {
  const cached = {
    schemaVersion: 1,
    username: 'demo',
    repositories: { publicRepositoryCount: 4, totalStars: 10, languages: [], fetchedAt: '2026-10-01T00:00:00.000Z' },
    featuredProjects: [{ fullName: 'demo/old', name: 'old', description: '', language: 'Rust', stars: 3, archived: false, htmlUrl: 'https://github.com/demo/old' }],
    contributions: { total: 99, from: '2025-10-01', to: '2026-10-01', weeks: [], fetchedAt: '2026-10-01T00:00:00.000Z' }
  };
  const fetchImpl = async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
  const result = await refreshCache({
    username: 'demo',
    featuredRepositories: ['demo/old'],
    cache: cached,
    fetchImpl,
    now: new Date('2026-10-08T12:00:00.000Z')
  });
  assert.equal(result.saveCache, false);
  assert.equal(result.rateLimited, true);
  assert.deepEqual(result.cache, cached);
  assert.equal(result.status.sections.repositories, 'cached');
  assert.match(result.warning, /retained/);
});

test('direct API error reports rate limits without exposing response payloads', async () => {
  await assert.rejects(
    requestJson('https://api.github.com/users/demo', {
      fetchImpl: async () => new Response('{"message":"private detail"}', { status: 429, headers: { 'retry-after': '90' } })
    }),
    (error) => error instanceof GitHubApiError && error.rateLimited && /90 seconds/.test(error.message) && !error.message.includes('private detail')
  );
});

test('network request timeout is reported and its timer is cleared after completion', async () => {
  await assert.rejects(
    requestJson('https://api.github.com/users/demo', {
      maxRetries: 0,
      timeoutMs: 1,
      fetchImpl: async (_url, { signal }) => await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      })
    }),
    (error) => error instanceof GitHubApiError && /request timed out/.test(error.message)
  );
});

test('generated project SVG escapes repository descriptions', () => {
  const oneProject = structuredClone(config);
  oneProject.github.featuredRepositories = ['demo/tool'];
  const svg = renderFeaturedProjects(oneProject, [{
    fullName: 'demo/tool', name: 'tool', description: '<script>alert(1)</script> & text', language: 'TypeScript', stars: 4, archived: false
  }]);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>/);
});

test('atomic writes skip identical outputs', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'profile-atomic-'));
  try {
    const output = path.join(directory, 'card.svg');
    assert.equal(await writeAtomicIfChanged(output, 'first'), true);
    assert.equal(await writeAtomicIfChanged(output, 'first'), false);
    assert.equal(await readFile(output, 'utf8'), 'first');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonResponse(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}
