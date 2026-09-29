import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ignored = new Set([
  'node_modules',
  '.git',
  '.angular',
  'dist',
  'test-results',
  'playwright-report',
  'package-lock.json',
  'tmp',
]);
const extensions = new Set(['.ts', '.mts', '.mjs', '.html', '.scss', '.json', '.md', '.rules']);
const oversized = [];
let checked = 0;

/** Traverses authored files while excluding generated output and dependency directories. */
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (extensions.has(extname(path))) {
      checked++;
      const text = await readFile(path, 'utf8');
      const lines = text.trimEnd().split(/\r?\n/).length;
      if (lines > 400) oversized.push(`${path}: ${lines} lines`);
    }
  }
}

await check('.');
if (oversized.length) {
  console.error(oversized.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `${checked} authored source/config/documentation files: maximum 400 lines each. Generated npm lockfile excluded.`,
  );
