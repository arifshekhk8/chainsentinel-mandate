import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

// Inspect the Git index, not ignored local invoices, credentials or generated files.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const contents = new Map(files.map((name) => [name, execFileSync('git', ['show', `:${name}`], { maxBuffer: 10 * 1024 * 1024 })]));
const errors = [];
const patterns = [
  /gsk_[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{30,}/,
  /AQ\.[A-Za-z0-9_-]{30,}/,
  /sk-[A-Za-z0-9_-]{24,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /["']privateKey["']\s*:\s*["'](?:0x)?[0-9a-fA-F]{64}/,
];
let links = 0;
for (const [name, bytes] of contents) {
  if (/(?:^|\/)(?:node_modules|out|cache|dist|broadcast|local-data|test-results|playwright-report|private|secrets|credentials|keystore)(?:\/|$)/i.test(name)
    || /(?:^|\/)\.env(?:\.|$)/i.test(name) && name !== '.env.example'
    || /\.(?:key|pem|p12|pfx|sqlite|db|keystore)(?:-|$)/i.test(name)) errors.push(`Private or generated path is tracked: ${name}`);
  if (/\.(?:png|jpe?g|pdf|xlsx)$/i.test(name)) continue;
  const text = bytes.toString('utf8');
  if (patterns.some((pattern) => pattern.test(text))) errors.push(`Possible credential in ${name}; value withheld`);
  if (name.endsWith('.md')) {
    if ((text.match(/^```/gm) ?? []).length % 2) errors.push(`Unclosed code fence: ${name}`);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '');
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      const path = posix.normalize(posix.join(posix.dirname(name), link.split('#')[0]));
      links++;
      if (!contents.has(path) && !files.some((file) => file.startsWith(`${path.replace(/\/$/, '')}/`))) errors.push(`Missing repository link: ${name} -> ${link}`);
    }
  }
}
for (const [name, expected] of Object.entries({
  'competition/rules.pdf': '9005e42629435a1e129a8367c8d3d5e3714b6ea0bbab30713cd6be2f2bdd0c5a',
  'competition/registration.xlsx': 'd0660876236f3476539d73701703032e6819cf4609ba481cd1b15061872462a2',
})) {
  if (!contents.has(name) || createHash('sha256').update(contents.get(name)).digest('hex') !== expected) errors.push(`Original competition template changed: ${name}`);
}
const example = contents.get('.env.example')?.toString('utf8') ?? '';
if (!example || example.split('\n').some((line) => /^\w+=.+/.test(line))) errors.push('.env.example must contain empty credential values');
const pkg = JSON.parse(contents.get('package.json').toString('utf8'));
if (pkg.private !== true) errors.push('package.json must remain private');
if (errors.length) {
  console.error(errors.join('\n')); process.exitCode = 1;
} else {
  console.log(`Repository checks passed: ${files.length} tracked files, ${links} local links, original templates, private-file exclusions and credential patterns.`);
  console.log('Pattern checks supplement human review; they do not prove that every possible secret is absent.');
}
