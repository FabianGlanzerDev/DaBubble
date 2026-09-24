import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Firebase browser apiKey/projectId are deliberately not treated as server secrets.
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['service account', /"type"\s*:\s*"service_account"/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_-]{20,}/],
];
const findings = [];
function inspect(label, content) {
  if (content.includes(0)) return;
  const text = content.toString('utf8');
  for (const [kind, pattern] of patterns)
    if (pattern.test(text)) findings.push(`${label}: ${kind}`);
}
function git(args) {
  return execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024 });
}
const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .toString()
  .split('\0')
  .filter(Boolean);
for (const file of files) inspect(file, await readFile(file));
const objects = git(['rev-list', '--objects', '--all', '--reflog'])
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);
let blobs = 0;
for (const entry of objects) {
  const [object] = entry.split(' ');
  if (git(['cat-file', '-t', object]).toString().trim() !== 'blob') continue;
  inspect(`Git blob ${object}`, git(['cat-file', 'blob', object]));
  blobs++;
}
if (findings.length) {
  console.error(findings.join('\n')); // Never print matching secret values.
  process.exitCode = 1;
} else {
  console.log(
    `${files.length} worktree files and ${blobs} historical Git blobs checked: no recognized private keys or tokens.`,
  );
  if (!objects.length) console.log('No commits or reflog-reachable history exists yet.');
}
