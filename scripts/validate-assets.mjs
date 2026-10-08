import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadConfig, ROOT } from './lib/config.mjs';

await loadConfig();
const schema = JSON.parse(await readFile(path.join(ROOT, 'schema/profile.config.schema.json'), 'utf8'));
if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' || schema.type !== 'object' || !schema.properties?.github) {
  throw new Error('profile.config.schema.json is not a valid Draft 2020-12 profile schema document.');
}
const svgPaths = await filesBelow(path.join(ROOT, 'assets'), (file) => file.toLowerCase().endsWith('.svg'));
if (!svgPaths.length) throw new Error('No SVG assets were found. Run `npm run generate` first.');

const python = process.platform === 'win32' ? 'python' : 'python3';
const xmlCheck = String.raw`import sys, xml.etree.ElementTree as ET
for filename in sys.argv[1:]:
    root = ET.parse(filename).getroot()
    if root.tag != '{http://www.w3.org/2000/svg}svg':
        raise SystemExit(f'{filename}: root element is not SVG')
    view_box = root.get('viewBox')
    if not view_box:
        raise SystemExit(f'{filename}: missing viewBox')
    try:
        x, y, width, height = [float(value) for value in view_box.replace(',', ' ').split()]
        if width <= 0 or height <= 0:
            raise ValueError('non-positive dimensions')
    except Exception:
        raise SystemExit(f'{filename}: invalid viewBox {view_box!r}')
    forbidden = {'script', 'foreignObject'}
    for node in root.iter():
        name = node.tag.rsplit('}', 1)[-1]
        if name in forbidden:
            raise SystemExit(f'{filename}: forbidden SVG element {name}')
        for key, value in node.attrib.items():
            if key.lower().startswith('on'):
                raise SystemExit(f'{filename}: event handler attribute is not allowed')
            if key.endswith('href') and value.startswith(('http:', 'https:', 'data:')):
                raise SystemExit(f'{filename}: external image/link reference is not allowed')
`;
const xml = spawnSync(python, ['-c', xmlCheck, ...svgPaths], { encoding: 'utf8', cwd: ROOT });
if (xml.error) throw new Error(`Could not start ${python} for SVG XML validation: ${xml.error.message}`);
if (xml.status !== 0) throw new Error(`SVG XML validation failed:\n${xml.stdout}${xml.stderr}`);

for (const file of svgPaths) {
  const details = await stat(file);
  if (details.size > 1_000_000) throw new Error(`${path.relative(ROOT, file)} exceeds the 1 MB image size limit.`);
}

const readme = await readFile(path.join(ROOT, 'README.md'), 'utf8');
await validateMarkdownLinks(readme, path.join(ROOT, 'README.md'));
if (/^\s*\|.*\|\s*$/m.test(readme)) throw new Error('README.md should not use Markdown tables for layout.');
if (/<\s*(script|iframe|object|embed)\b|javascript:/i.test(readme)) throw new Error('README.md contains unsupported or unsafe embedded content.');

const sourceFiles = [
  path.join(ROOT, 'profile.config.json'),
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'README.md'),
  path.join(ROOT, 'schema/profile.config.schema.json'),
  ...(await filesBelow(path.join(ROOT, 'scripts'), (file) => file.endsWith('.mjs'))),
  ...(await filesBelow(path.join(ROOT, '.github/workflows'), (file) => file.endsWith('.yml') || file.endsWith('.yaml'))),
  ...(await filesBelow(path.join(ROOT, 'docs'), (file) => file.endsWith('.md'))),
  ...(await filesBelow(path.join(ROOT, 'assets'), (file) => file.endsWith('.svg') || file.endsWith('.json')))
];
const tokenPattern = /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/;
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  if (tokenPattern.test(content)) throw new Error(`Possible hard-coded GitHub token found in ${path.relative(ROOT, file)}.`);
}

console.log(`Validated config, ${svgPaths.length} well-formed SVG files, README asset links, and credential patterns.`);

async function filesBelow(directory, predicate) {
  const result = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return result;
    throw error;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) result.push(fullPath);
  }
  return result;
}

async function validateMarkdownLinks(markdown, markdownPath) {
  const fileDirectory = path.dirname(markdownPath);
  const markdownTargets = [...markdown.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]);
  const htmlTargets = [...markdown.matchAll(/(?:src|href|srcset)="([^"]+)"/g)].flatMap((match) => match[1].split(',').map((item) => item.trim().split(/\s+/)[0]));
  for (const target of [...markdownTargets, ...htmlTargets]) {
    if (/^(?:https?:|mailto:|#|data:|javascript:)/i.test(target)) continue;
    const withoutFragment = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    if (!withoutFragment) continue;
    try {
      await stat(path.resolve(fileDirectory, withoutFragment));
    } catch {
      throw new Error(`${path.relative(ROOT, markdownPath)} references a missing local file: ${target}`);
    }
  }
}
