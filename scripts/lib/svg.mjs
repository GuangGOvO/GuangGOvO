import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './config.mjs';
import { writeAtomicIfChanged } from './files.mjs';

export function xml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function shortText(value, maxCharacters) {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  const chars = Array.from(text);
  return chars.length <= maxCharacters ? text : `${chars.slice(0, Math.max(1, maxCharacters - 1)).join('')}…`;
}

export function renderHero(config, theme, animated) {
  const colors = config.brand.colors[theme];
  const configuredLines = config.hero.typewriterLines;
  const typedLine = configuredLines.length ? configuredLines.join('  /  ') : 'Configure profile.config.json to add a short intro.';
  const tagline = config.hero.tagline || config.identity.headline || 'Public profile details are added through configuration.';
  const charCount = Array.from(typedLine).length;
  const clipWidth = Math.max(8, charCount * 9.3);
  const clipAnimation = animated ? `<animate attributeName="width" values="0;${clipWidth};${clipWidth};0;0" keyTimes="0;0.48;0.76;0.96;1" dur="8s" repeatCount="indefinite" />` : '';
  const cursorAnimation = animated ? '<animate attributeName="opacity" values="0.25;1;0.25" dur="1.15s" repeatCount="indefinite" />' : '';
  const cursorMove = animated ? `<animate attributeName="x" values="42;${Math.min(904, 42 + clipWidth + 4)};${Math.min(904, 42 + clipWidth + 4)};42;42" keyTimes="0;0.48;0.76;0.96;1" dur="8s" repeatCount="indefinite" />` : '';
  const title = shortText(tagline, 86);
  const safeTypedLine = xml(shortText(typedLine, 90));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="286" viewBox="0 0 960 286" role="img" aria-labelledby="title desc">
  <title id="title">${xml(config.brand.name)} terminal welcome</title>
  <desc id="desc">${xml(title)} Terminal-style welcome banner. A static fallback is available for reduced motion.</desc>
  <rect width="960" height="286" rx="18" fill="${colors.background}" />
  <rect x="1" y="1" width="958" height="284" rx="17" fill="none" stroke="${colors.border}" />
  <path d="M1 54h958" stroke="${colors.border}" />
  <circle cx="27" cy="27" r="6" fill="${colors.muted}" opacity=".55" />
  <circle cx="48" cy="27" r="6" fill="${colors.muted}" opacity=".55" />
  <circle cx="69" cy="27" r="6" fill="${colors.green}" />
  <text x="90" y="32" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">${xml(config.brand.name)} / profile</text>
  <text x="42" y="94" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="15">guest@workspace:~$ ./welcome.sh</text>
  <text x="42" y="151" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="36" font-weight="700">Hello, World!</text>
  <text x="42" y="188" fill="${colors.blue}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="16">&gt; ${xml(shortText(tagline, 72))}</text>
  <defs><clipPath id="typing-window"><rect x="41" y="205" width="${animated ? 0 : clipWidth}" height="23">${clipAnimation}</rect></clipPath></defs>
  <text x="42" y="223" clip-path="url(#typing-window)" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="15">${safeTypedLine}</text>
  <rect x="${animated ? 42 : Math.min(904, 42 + clipWidth + 4)}" y="207" width="8" height="18" rx="1" fill="${colors.green}">${cursorAnimation}${cursorMove}</rect>
  <text x="42" y="260" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="12">${animated ? 'SVG typewriter · prefers-reduced-motion uses the static image' : 'Static image · no animation'}</text>
</svg>\n`;
}

export function renderLogo(config, theme, animated) {
  const colors = config.brand.colors[theme];
  const animation = animated ? '<animate attributeName="opacity" values=".45;1;.45" dur="1.8s" repeatCount="indefinite" />' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" role="img" aria-labelledby="title">
  <title id="title">${xml(config.brand.name)} logo</title>
  <rect x="1" y="1" width="46" height="46" rx="12" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="24" y="32" text-anchor="middle" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="22" font-weight="700">${xml(config.brand.mark)}</text>
  <circle cx="36" cy="13" r="2.5" fill="${colors.blue}">${animation}</circle>
</svg>\n`;
}

export function renderStatus(config, username, cache, fetchStatus, theme = 'dark', animated = true) {
  const colors = config.brand.colors[theme];
  const hasProfile = Boolean(username);
  const repoState = fetchStatus?.sections?.repositories;
  const state = !hasProfile ? 'profile data: not configured' : repoState === 'error' ? 'API issue: keeping previous data' : repoState === 'cached' ? 'using last successful refresh' : repoState === 'fresh' ? 'profile data: ready' : 'waiting for the first data refresh';
  const hue = !hasProfile ? colors.amber : repoState === 'error' ? colors.amber : colors.green;
  const repoCount = cache?.repositories?.publicRepositoryCount;
  const summary = Number.isInteger(repoCount) ? `${repoCount} public repositories available` : hasProfile ? 'Public GitHub data appears after the first successful refresh' : 'GitHub profile data will appear after configuration';
  const pulse = animated ? '<animate attributeName="opacity" values=".35;.9;.35" dur="2.4s" repeatCount="indefinite" />' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="88" viewBox="0 0 960 88" role="img" aria-labelledby="title">
  <title id="title">Profile update status</title>
  <rect x="1" y="1" width="958" height="86" rx="14" fill="${colors.panel}" stroke="${colors.border}" />
  <circle cx="30" cy="31" r="5" fill="${hue}">${pulse}</circle>
  <text x="48" y="36" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="15">${xml(state)}</text>
  <text x="28" y="66" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="13">${xml(summary)}</text>
</svg>\n`;
}

export function renderSnakePlaceholder(config, theme) {
  const colors = config.brand.colors[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="168" viewBox="0 0 960 168" role="img" aria-labelledby="title">
  <title id="title">Contribution snake setup status</title>
  <rect x="1" y="1" width="958" height="166" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <path d="M50 92h860" stroke="${colors.border}" stroke-width="2" stroke-dasharray="5 9" />
  <circle cx="85" cy="92" r="8" fill="${colors.green}" /><circle cx="109" cy="92" r="8" fill="${colors.blue}" />
  <text x="30" y="43" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">$ contribution-snake --setup</text>
  <text x="30" y="137" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="13">Run the contribution-snake workflow to generate this animation from the public calendar.</text>
</svg>\n`;
}

export function renderFeaturedProjects(config, projects, fetchStatus = {}, theme = 'dark') {
  const colors = config.brand.colors[theme];
  if (!config.github.featuredRepositories.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="170" viewBox="0 0 960 170" role="img" aria-labelledby="title desc">
  <title id="title">Featured projects are not configured</title><desc id="desc">No repositories have been selected in profile.config.json.</desc>
  <rect x="1" y="1" width="958" height="168" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="32" y="58" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">$ ls ./featured-projects</text>
  <text x="32" y="98" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="17">No repositories selected</text>
  <text x="32" y="129" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="13">Add public owner/repository names to github.featuredRepositories.</text>
</svg>\n`;
  }

  const byName = new Map((Array.isArray(projects) ? projects : []).map((item) => [item.fullName.toLowerCase(), item]));
  const rows = config.github.featuredRepositories.map((name) => byName.get(name.toLowerCase())).filter(Boolean);
  if (!rows.length) {
    const failed = fetchStatus.sections?.featuredProjects === 'error';
    const message = failed ? 'GitHub API request failed; no previously cached project data is available yet.' : 'Selected repositories will appear after the first successful data refresh.';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="170" viewBox="0 0 960 170" role="img" aria-labelledby="title desc">
  <title id="title">Featured project data pending</title><desc id="desc">${xml(message)}</desc>
  <rect x="1" y="1" width="958" height="168" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="32" y="58" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">$ git fetch --profile</text>
  <text x="32" y="99" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="15">${xml(shortText(message, 100))}</text>
  <text x="32" y="131" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="13">Existing valid project data is retained when a refresh fails.</text>
</svg>\n`;
  }

  const height = 66 + rows.length * 91;
  const body = rows.map((repo, index) => {
    const y = 42 + index * 91;
    const archived = repo.archived ? '  ·  archived' : '';
    const language = repo.language || 'language not reported';
    return `  <g>
    <rect x="16" y="${y}" width="928" height="78" rx="12" fill="${colors.background}" stroke="${colors.border}" />
    <text x="34" y="${y + 26}" fill="${colors.blue}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="16" font-weight="700">${xml(shortText(repo.fullName, 54))}</text>
    <text x="34" y="${y + 51}" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="12">${xml(shortText(repo.description || 'No public description', 96))}</text>
    <text x="740" y="${y + 29}" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="12">${xml(shortText(language, 18))}</text>
    <text x="740" y="${y + 53}" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="12">★ ${Number.isSafeInteger(repo.stars) ? repo.stars : 0}${xml(archived)}</text>
  </g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Featured GitHub projects</title><desc id="desc">Selected public repositories and their live language and star data.</desc>
  <rect width="960" height="${height}" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="24" y="28" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="11">PROJECTS · PUBLIC GITHUB DATA</text>
${body}
</svg>\n`;
}

export function renderTechStack(config, theme = 'dark') {
  const colors = config.brand.colors[theme];
  const entries = Object.entries(config.technologyStack).filter(([, names]) => names.length > 0);
  if (!entries.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="156" viewBox="0 0 960 156" role="img" aria-labelledby="title">
  <title id="title">Technology stack not configured</title>
  <rect x="1" y="1" width="958" height="154" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="30" y="60" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">$ cat ./tech-stack.json</text>
  <text x="30" y="101" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">Add only technologies you have actually used to profile.config.json.</text>
</svg>\n`;
  }

  const groupedRows = entries.map(([category, names]) => {
    const rows = [[]];
    let usedWidth = 0;
    for (const name of names) {
      const label = shortText(name, 34);
      const width = Math.max(112, Math.min(236, Array.from(label).length * 8 + 56));
      if (usedWidth + width > 740 && rows.at(-1).length > 0) {
        rows.push([]);
        usedWidth = 0;
      }
      rows.at(-1).push({ label, width });
      usedWidth += width;
    }
    return { category, rows };
  });
  const rowPitch = 48;
  const height = 24 + groupedRows.reduce((sum, group) => sum + group.rows.length * rowPitch + 8, 0);
  let body = '';
  let y = 22;
  for (const group of groupedRows) {
    body += `  <text x="20" y="${y + 22}" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="12">${xml(group.category)}</text>\n`;
    for (const row of group.rows) {
      let x = 190;
      for (const { label, width } of row) {
        const monogram = Array.from(label.replace(/[^\p{L}\p{N}]/gu, '')).slice(0, 2).join('').toUpperCase() || '·';
        body += `  <g><rect x="${x}" y="${y}" width="${width - 8}" height="36" rx="9" fill="${colors.background}" stroke="${colors.border}" /><rect x="${x + 8}" y="${y + 7}" width="22" height="22" rx="6" fill="${colors.panel}" stroke="${colors.border}" /><text x="${x + 19}" y="${y + 22}" text-anchor="middle" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="10" font-weight="700">${xml(monogram)}</text><text x="${x + 38}" y="${y + 23}" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="12">${xml(label)}</text></g>\n`;
        x += width;
      }
      y += rowPitch;
    }
    y += 8;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img" aria-labelledby="title">
  <title id="title">Configured technology stack</title>
  <rect width="960" height="${height}" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
${body}</svg>\n`;
}

export function renderStats(config, cache, theme, fetchStatus, animated = true) {
  const colors = config.brand.colors[theme];
  const data = cache?.repositories;
  const error = fetchStatus?.sections?.repositories === 'error';
  const unavailable = !data;
  const values = [
    { label: 'PUBLIC REPOSITORIES', value: Number.isInteger(data?.publicRepositoryCount) ? String(data.publicRepositoryCount) : '—' },
    { label: 'STARS · OWN PUBLIC REPOS', value: Number.isInteger(data?.totalStars) ? String(data.totalStars) : '—' },
    { label: 'PRIMARY LANGUAGES', value: data?.languages?.length ? data.languages.slice(0, 3).map((item) => item.name).join(' · ') : '—' }
  ];
  const cards = values.map((item, index) => {
    const x = 18 + index * 314;
    const pulse = animated ? '<animate attributeName="opacity" values=".3;.8;.3" dur="3s" repeatCount="indefinite" />' : '';
    return `  <g><rect x="${x}" y="24" width="294" height="112" rx="14" fill="${colors.background}" stroke="${colors.border}"/><circle cx="${x + 270}" cy="43" r="3" fill="${colors.green}">${pulse}</circle><text x="${x + 18}" y="54" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="11">${xml(item.label)}</text><text x="${x + 18}" y="98" fill="${colors.text}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="${item.value.length > 20 ? 15 : 27}" font-weight="700">${xml(shortText(item.value, 26))}</text></g>`;
  }).join('\n');
  const note = unavailable
    ? error ? 'GitHub API unavailable · no previous data was replaced' : cache?.username ? 'No cached data yet · refresh this profile after publishing it' : 'Set the profile username to load public repository data'
    : `${data.complete ? 'all public repositories' : `first ${data.repositoriesScanned} repositories`} · primary language ranked by repository count · refreshed ${String(data.fetchedAt).slice(0, 10)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="178" viewBox="0 0 960 178" role="img" aria-labelledby="title desc">
  <title id="title">GitHub public repository statistics</title><desc id="desc">Public repository count, stars across owned public repositories, and primary languages counted once per repository.</desc>
  <rect width="960" height="178" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
${cards}
  <text x="22" y="162" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="11">${xml(shortText(note, 130))}</text>
</svg>\n`;
}

export function renderContributionGrid(config, contributions, theme) {
  const colors = config.brand.colors[theme];
  if (!contributions?.weeks?.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="156" viewBox="0 0 960 156" role="img" aria-labelledby="title">
  <title id="title">Contribution calendar pending</title>
  <rect x="1" y="1" width="958" height="154" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="28" y="61" fill="${colors.green}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14">$ contribution-calendar --public --period 365d</text>
  <text x="28" y="100" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="13">Calendar data will appear after the first successful GitHub API refresh.</text>
</svg>\n`;
  }
  const dotColors = [colors.panel, `${colors.green}55`, `${colors.green}88`, colors.green, colors.blue];
  const levelIndex = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const weeks = contributions.weeks.slice(-53);
  const xStart = 54;
  const yStart = 28;
  const pitchX = 16;
  const pitchY = 16;
  let dots = '';
  weeks.forEach((week, weekIndex) => {
    for (const day of week.contributionDays ?? []) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const weekday = (date.getUTCDay() + 6) % 7;
      if (!Number.isInteger(levelIndex[day.contributionLevel])) continue;
      dots += `  <rect x="${xStart + weekIndex * pitchX}" y="${yStart + weekday * pitchY}" width="10" height="10" rx="2" fill="${dotColors[levelIndex[day.contributionLevel]]}" stroke="${colors.border}" stroke-width=".45"><title>${xml(day.date)} · ${Number.isInteger(day.contributionCount) ? day.contributionCount : 0} contributions</title></rect>\n`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="176" viewBox="0 0 960 176" role="img" aria-labelledby="title desc">
  <title id="title">Public contribution calendar, past year</title><desc id="desc">${Number.isInteger(contributions.total) ? contributions.total : 0} public contributions from ${xml(contributions.from)} to ${xml(contributions.to)}.</desc>
  <rect width="960" height="176" rx="16" fill="${colors.panel}" stroke="${colors.border}" />
  <text x="24" y="19" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="11">PUBLIC CONTRIBUTIONS · ${Number.isInteger(contributions.total) ? contributions.total : 0} · ${xml(contributions.from)} — ${xml(contributions.to)}</text>
  <text x="21" y="50" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="9">Mon</text>
  <text x="27" y="82" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="9">Wed</text>
  <text x="22" y="114" fill="${colors.muted}" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="9">Fri</text>
${dots}</svg>\n`;
}

export async function writeSvg(filePath, svg) {
  return writeAtomicIfChanged(filePath, svg);
}

export async function writeSvgIfMissing(filePath, svg) {
  try {
    await access(filePath);
    return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return writeAtomicIfChanged(filePath, svg);
}

export async function loadCache(root = ROOT) {
  try {
    return JSON.parse(await readFile(path.join(root, 'assets/cache/github-data.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, username: '', repositories: null, featuredProjects: null, contributions: null };
    throw new Error(`Cannot read GitHub data cache: ${error.message}`);
  }
}
