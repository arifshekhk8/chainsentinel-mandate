import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const MAX_BYTES = 8 * 1024 * 1024;
const fail = () => new Error('Persistent storage is unavailable or changed. Stop and restart from the saved cloud state. No automatic resend is allowed.');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function encryptState(bytes, secret, workspace) {
  if (bytes.length > MAX_BYTES || typeof secret !== 'string' || secret.length < 32) throw fail();
  const nonce = randomBytes(12);
  const key = createHash('sha256').update('mandate-hosted-state-v1\0' + secret).digest();
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(workspace));
  return JSON.stringify({ format: 'mandate-encrypted-sqlite-v1', nonce: nonce.toString('base64'),
    data: Buffer.concat([cipher.update(bytes), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') });
}

export function decryptState(value, secret, workspace) {
  try {
    const data = JSON.parse(value);
    if (data.format !== 'mandate-encrypted-sqlite-v1' || typeof secret !== 'string' || secret.length < 32
      || typeof data.data !== 'string' || data.data.length > Math.ceil(MAX_BYTES / 3) * 4
      || Buffer.from(data.nonce, 'base64').length !== 12 || Buffer.from(data.tag, 'base64').length !== 16) throw fail();
    const key = createHash('sha256').update('mandate-hosted-state-v1\0' + secret).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(data.nonce, 'base64'));
    decipher.setAAD(Buffer.from(workspace)); decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
    const bytes = Buffer.concat([decipher.update(Buffer.from(data.data, 'base64')), decipher.final()]);
    if (!bytes.subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))) throw fail();
    return bytes;
  } catch { throw fail(); }
}

export class CloudState {
  #repository; #secret; #workspace; #path; #revision = 0; #digest; #queue = Promise.resolve();
  healthy = true;
  constructor({ repository, secret, workspace, path }) {
    if (!repository || !/^[a-z0-9-]{8,100}$/.test(workspace) || typeof secret !== 'string' || secret.length < 32) throw fail();
    this.#repository = repository; this.#secret = secret; this.#workspace = workspace; this.#path = path;
  }
  async restore() {
    try {
      await this.#repository.initialize();
      const record = await this.#repository.read(this.#workspace);
      // The hosted launcher uses a fresh temporary path. Never erase an existing local database.
      if (existsSync(this.#path)) throw fail();
      mkdirSync(dirname(this.#path), { recursive: true, mode: 0o700 });
      if (record) {
        const bytes = decryptState(record.payload, this.#secret, this.#workspace);
        this.#revision = Number(record.revision);
        if (!Number.isSafeInteger(this.#revision) || this.#revision < 1) throw fail();
        writeFileSync(this.#path, bytes, { mode: 0o600, flag: 'wx' }); this.#digest = digest(bytes);
      }
    } catch { this.healthy = false; throw fail(); }
  }
  persist({ force = false } = {}) {
    const next = this.#queue.then(async () => {
      if (!this.healthy) throw fail();
      try {
        // Store uses synchronous SQLite commits in DELETE journal mode. HTTP work is serialized.
        // Read synchronously so another JS task cannot interleave a database write with this copy.
        const bytes = readFileSync(this.#path);
        const hash = digest(bytes);
        if (bytes.length > MAX_BYTES) throw fail();
        if (hash === this.#digest && !force) return;
        const payload = encryptState(bytes, this.#secret, this.#workspace);
        const revision = await this.#repository.compareAndSet(this.#workspace, this.#revision, payload);
        if (revision !== this.#revision + 1) throw fail();
        this.#revision = revision; this.#digest = hash;
      } catch { this.healthy = false; throw fail(); }
    });
    this.#queue = next.catch(() => {}); return next;
  }
  async assertCurrent() {
    if (!this.healthy) throw fail();
    try {
      const revision = await this.#repository.revision(this.#workspace);
      if (Number(revision) !== this.#revision) throw fail();
    } catch { this.healthy = false; throw fail(); }
  }
}

export function durableProvider(provider, state) {
  // Keep the tested core service/executor unchanged. Every provider operation first flushes
  // committed state, including a signed hash before broadcast and an owner hash before receipt RPC.
  const methods = new Map();
  return new Proxy(provider, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (['destroy', 'on', 'off', 'once', 'removeAllListeners'].includes(property)) return value.bind(target);
      if (!methods.has(property)) methods.set(property, async (...args) => { await state.persist(); return value.apply(target, args); });
      return methods.get(property);
    },
    set(target, property, value) { return Reflect.set(target, property, value, target); },
  });
}
