import { neon } from '@neondatabase/serverless';

export function neonRepository(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Set a private Neon DATABASE_URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')
    || !url.username || !url.password || url.pathname.length < 2) throw new Error('Set a valid private Neon DATABASE_URL.');
  const sql = neon(connectionString);
  const query = (text, params = []) => sql.query(text, params, { fetchOptions: { signal: AbortSignal.timeout(20000), redirect: 'error' } });
  return {
    async initialize() {
      await query(`CREATE TABLE IF NOT EXISTS mandate_hosted_state (
        workspace TEXT PRIMARY KEY, revision BIGINT NOT NULL CHECK(revision > 0),
        payload TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    },
    async read(workspace) { return (await query('SELECT revision,payload FROM mandate_hosted_state WHERE workspace=$1', [workspace]))[0] ?? null; },
    async revision(workspace) { return (await query('SELECT revision FROM mandate_hosted_state WHERE workspace=$1', [workspace]))[0]?.revision ?? 0; },
    async compareAndSet(workspace, expected, payload) {
      const rows = expected === 0
        ? await query(`INSERT INTO mandate_hosted_state(workspace,revision,payload) VALUES ($1,1,$2)
          ON CONFLICT(workspace) DO NOTHING RETURNING revision`, [workspace, payload])
        : await query(`UPDATE mandate_hosted_state SET revision=revision+1,payload=$1,updated_at=now()
          WHERE workspace=$2 AND revision=$3 RETURNING revision`, [payload, workspace, expected]);
      return Number(rows[0]?.revision ?? -1);
    },
  };
}
