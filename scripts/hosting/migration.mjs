import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { decryptState, encryptState } from './persistence.mjs';
import { neonRepository } from './neon.mjs';

export async function snapshotDatabase(source, destination) {
  if (!existsSync(source) || existsSync(destination)) throw new Error('Preserve existing database files; use a new snapshot destination.');
  const database = new DatabaseSync(source, { readOnly: true });
  try { await backup(database, destination); } finally { database.close(); }
}

export async function migrateInitialWorkspace({ source, destination, repository, secret, workspace }) {
  await repository.initialize();
  if (await repository.read(workspace)) throw new Error('The cloud workspace already exists. Never overwrite it with an older local copy.');
  await snapshotDatabase(source, destination);
  const bytes = readFileSync(destination);
  const database = new DatabaseSync(destination, { readOnly: true });
  let counts;
  try {
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('SQLite integrity check failed.');
    counts = Object.fromEntries(['documents', 'drafts', 'intents', 'agent_plans', 'payments']
      .map((table) => [table, database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n]));
  } finally { database.close(); }
  const revision = await repository.compareAndSet(workspace, 0, encryptState(bytes, secret, workspace));
  if (revision !== 1) throw new Error('Cloud initialization was not acknowledged. Inspect existing state; never retry blindly.');
  const restored = await repository.read(workspace);
  if (Number(restored?.revision) !== 1 || !decryptState(restored.payload, secret, workspace).equals(bytes)) {
    throw new Error('Cloud restoration verification failed. Preserve the local snapshot and storage secret.');
  }
  return { revision, counts, bytes: bytes.length, snapshotSha256: createHash('sha256').update(bytes).digest('hex'), encryptedReadBackMatches: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    const env = parseEnv(readFileSync('local-data/hosting/render-secrets.env', 'utf8'));
    const result = await migrateInitialWorkspace({ source: 'local-data/sepolia/mandate.sqlite',
      destination: 'local-data/hosting/sepolia-initial.sqlite', repository: neonRepository(env.DATABASE_URL),
      secret: env.MANDATE_STORAGE_SECRET, workspace: 'mandate-sepolia-owner-v1' });
    writeFileSync('local-data/hosting/migration-verification.json', JSON.stringify({ verifiedAt: new Date().toISOString(), ...result }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify(result));
  } catch {
    console.error('Initial migration stopped. Preserve local data and private settings; inspect cloud state before any retry.');
    process.exitCode = 1;
  }
}
