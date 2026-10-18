import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec('PRAGMA secure_delete=ON; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, filename TEXT NOT NULL, hash TEXT NOT NULL,
        source TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS drafts (seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, fields TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1, review TEXT, warnings TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, payload TEXT NOT NULL,
        status TEXT NOT NULL, hash TEXT UNIQUE, receipt TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS agent_plans (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL,
        payload TEXT NOT NULL, status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL,
        payload TEXT NOT NULL, status TEXT NOT NULL, hash TEXT UNIQUE NOT NULL, receipt TEXT, error TEXT);
    `);
  }
  importDocument(document) {
    const id = randomUUID();
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(id, document.filename, document.hash, document.sourceText, new Date().toISOString());
      const insert = this.db.prepare('INSERT INTO drafts(id,document_id,fields,warnings) VALUES (?,?,?,?)');
      for (const record of document.records) insert.run(randomUUID(), id, JSON.stringify(record.fields), JSON.stringify(record.extractionWarnings));
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return id;
  }
  drafts() {
    return this.db.prepare(`SELECT d.*,s.filename,s.hash AS document_hash,s.source FROM drafts d
      JOIN documents s ON s.id=d.document_id ORDER BY d.seq`).all().map((row) => ({ ...row,
      fields: JSON.parse(row.fields), review: row.review ? JSON.parse(row.review) : null, warnings: JSON.parse(row.warnings) }));
  }
  draft(id) { return this.drafts().find((row) => row.id === id); }
  updateDraft(id, version, fields) {
    return this.db.prepare('UPDATE drafts SET fields=?, version=version+1, review=NULL WHERE id=? AND version=?')
      .run(JSON.stringify(fields), id, version).changes === 1;
  }
  reviewDraft(id, review) { this.db.prepare('UPDATE drafts SET review=? WHERE id=?').run(JSON.stringify(review), id); }
  deleteDocument(id) {
    const ids = new Set(this.drafts().filter((r) => r.document_id === id).map((r) => r.id));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of this.db.prepare('SELECT id,payload FROM agent_plans').all()) {
        const p = JSON.parse(row.payload);
        if (ids.has(p.draftId ?? p.correction?.draftId) || p.plan?.entries.some((e) => ids.has(e.id))) this.db.prepare('DELETE FROM agent_plans WHERE id=?').run(row.id);
      }
      for (const row of this.db.prepare('SELECT id,payload FROM payments').all()) {
        const p = JSON.parse(row.payload);
        if (ids.has(p.draftId)) { p.invoice = 'Removed source'; this.db.prepare('UPDATE payments SET payload=? WHERE id=?').run(JSON.stringify(p), row.id); }
      }
      this.db.prepare('DELETE FROM documents WHERE id=?').run(id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  intents() { return this.db.prepare('SELECT * FROM intents ORDER BY rowid DESC').all().map((r) => ({ ...r, payload: JSON.parse(r.payload), receipt: r.receipt ? JSON.parse(r.receipt) : null })); }
  intent(id) { return this.intents().find((row) => row.id === id); }
  addIntent(payload) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO intents(id,payload,status) VALUES (?,?,?)').run(id, JSON.stringify(payload), 'prepared');
    return this.intent(id);
  }
  setIntent(id, status, hash, receipt = null, error = null) {
    this.db.prepare('UPDATE intents SET status=?,hash=?,receipt=?,error=? WHERE id=?')
      .run(status, hash, receipt ? JSON.stringify(receipt) : null, error, id);
    return this.intent(id);
  }
  plans(instance) { return this.db.prepare('SELECT * FROM agent_plans WHERE instance_id=? ORDER BY rowid DESC').all(instance).map((r) => ({ ...r, payload: JSON.parse(r.payload) })); }
  addPlan(instance, payload) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO agent_plans VALUES (?,?,?,?)').run(id, instance, JSON.stringify(payload), 'prepared');
    return this.plans(instance).find((p) => p.id === id);
  }
  finishPlan(id, status) { this.db.prepare('UPDATE agent_plans SET status=? WHERE id=?').run(status, id); }
  claimPlan(id, instance) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const busy = this.db.prepare("SELECT id FROM agent_plans WHERE instance_id=? AND status='running'").get(instance);
      const unresolved = this.db.prepare("SELECT id FROM payments WHERE instance_id=? AND status IN ('submitting','submitted','outcome_unknown','invalid')").get(instance);
      const ok = !busy && !unresolved && this.db.prepare("UPDATE agent_plans SET status='running',payload=json_set(payload,'$.runtimePid',?) WHERE id=? AND instance_id=? AND status='prepared'").run(process.pid, id, instance).changes === 1;
      this.db.exec('COMMIT'); return ok;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  recoverAbandonedPlans(instance) {
    for (const p of this.plans(instance).filter((p) => p.status === 'running')) {
      if (!Number.isSafeInteger(p.payload.runtimePid) || p.payload.runtimePid <= 0) continue;
      try { process.kill(p.payload.runtimePid, 0); }
      catch (error) { if (error.code === 'ESRCH') this.finishPlan(p.id, 'interrupted'); }
    }
    // A live/reused PID remains locked. Uncertain payment hashes always retain their separate lock.
  }
  payments(instance) { return this.db.prepare('SELECT * FROM payments WHERE instance_id=? ORDER BY rowid').all(instance).map((r) => ({ ...r, payload: JSON.parse(r.payload), receipt: r.receipt ? JSON.parse(r.receipt) : null })); }
  addPayment(instance, payload, hash) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO payments(id,instance_id,payload,status,hash) VALUES (?,?,?,?,?)').run(id, instance, JSON.stringify(payload), 'submitting', hash);
    return id;
  }
  setPayment(id, status, receipt = null, error = null) {
    this.db.prepare('UPDATE payments SET status=?,receipt=?,error=? WHERE id=?').run(status, receipt ? JSON.stringify(receipt) : null, error, id);
  }
  close() { this.db.close(); }
}
