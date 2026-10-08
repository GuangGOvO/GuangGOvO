import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    throw new Error(`Cannot parse JSON at ${filePath}: ${error.message}`);
  }
}

export async function writeAtomicIfChanged(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`;
  try {
    if (await readFile(filePath, 'utf8') === text) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, 'utf8');
  await rename(temporary, filePath);
  return true;
}
