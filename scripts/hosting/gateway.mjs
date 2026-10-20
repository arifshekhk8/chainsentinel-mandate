import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const MAX_BODY = 5 * 1024 * 1024 + 65536;
const AGE = 8 * 60 * 60;
const COOKIE = '__Host-mandate_session';
const css = `body.login-page{margin:0;font-family:Arial,sans-serif;color:#17213a;background:#f4f6fa}.login{box-sizing:border-box;max-width:420px;margin:12vh auto;padding:32px;background:white;border:1px solid #d8dfeb;border-radius:14px}.login h1{font-size:32px;margin:0 0 8px}.login p{line-height:1.5}.login label{display:block;margin:28px 0 8px}.login input{box-sizing:border-box;font:inherit;width:100%;padding:12px;border:1px solid #8898b0;border-radius:7px}.login button{font:inherit;cursor:pointer;padding:11px 18px;background:#254acf;color:white;border:0;border-radius:7px;margin-top:16px}.hosted-bar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:8px 24px;background:#edf1fa;color:#243455;border-bottom:1px solid #d8dfeb;font:13px Arial,sans-serif}.hosted-bar form{margin:0}.hosted-bar button{font:inherit;padding:5px 10px;margin:0;background:transparent;color:#243455;border:1px solid #a5b1c8}`;
const login = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mandate owner sign in</title><link rel="stylesheet" href="/_hosted.css"></head><body class="login-page"><main class="login"><h1>Mandate</h1><p>Sign in to your owner workspace.</p><form method="post" action="/login"><label for="password">Workspace password</label><input id="password" name="password" type="password" required autocomplete="current-password" maxlength="256"><button type="submit">Sign in</button></form><p>Synthetic bills and Sepolia test tokens only.</p></main></body></html>`;
const hash = (value) => createHash('sha256').update(value).digest();

export async function startGateway({ upstream, publicOrigin, password, sessionSecret, state, port = 10000,
  host = '0.0.0.0', allowInsecureLocal = false, now = () => Date.now() }) {
  const canonical = new URL(publicOrigin);
  const localTest = allowInsecureLocal && canonical.protocol === 'http:' && canonical.hostname === '127.0.0.1';
  if ((!localTest && canonical.protocol !== 'https:') || canonical.username || canonical.password || canonical.pathname !== '/'
    || canonical.search || canonical.hash || typeof password !== 'string' || password.length < 32
    || typeof sessionSecret !== 'string' || sessionSecret.length < 32) throw new Error('Configure HTTPS and strong private workspace secrets.');
  const origin = canonical.origin;
  const expectedPassword = hash(password);
  const cookieName = localTest ? 'mandate_session_test' : COOKIE;
  const mac = (value) => createHmac('sha256', sessionSecret).update(value).digest('hex');
  const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; ${localTest ? '' : 'Secure; '}SameSite=Strict; Path=/; Max-Age=${age}`;
  const sessions = new Map();
  let queue = Promise.resolve(), waiting = 0, failures = 0, failureWindow = now(), closing = false, closePromise;
  const sessionValue = (req) => String(req.headers.cookie ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  function authenticated(req) {
    const value = sessionValue(req);
    if (!value || !sessions.has(value) || !/^\d{10}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(value)) return false;
    const [issued, nonce, signature] = value.split('.'), age = Math.floor(now() / 1000) - Number(issued);
    return age >= 0 && age < AGE && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(mac(issued + '.' + nonce), 'hex'));
  }
  const server = createServer(async (req, res) => {
    const respond = (status, text, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type }); res.end(text);
    };
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    // Browser navigation forms need their same-origin Origin header for the login/logout checks.
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (!localTest) res.setHeader('strict-transport-security', 'max-age=31536000');
    try {
      if (closing) return respond(503, 'Workspace is restarting.');
      // Render health probes do not need a session or touch Neon/chain/model services.
      if (req.method === 'GET' && req.url === '/healthz') return respond(state.healthy ? 200 : 503, state.healthy ? 'ready' : 'storage unavailable');
      if (req.headers.host !== canonical.host || (req.headers.origin && req.headers.origin !== origin)) return respond(403, 'Unexpected host or origin.');
      const url = new URL(req.url, origin);
      if (url.origin !== origin) return respond(403, 'Unexpected origin.');
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) return respond(403, 'Open this workspace before making changes.');
      if (req.method === 'GET' && url.pathname === '/_hosted.css') return respond(200, css, 'text/css; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/login') return respond(200, login, 'text/html; charset=utf-8');
      if (!authenticated(req) && !(req.method === 'POST' && url.pathname === '/login')) {
        if (url.pathname.startsWith('/api/')) return respond(401, 'Sign in to the owner workspace.');
        res.setHeader('location', '/login'); return respond(303, 'Sign in to the owner workspace.');
      }
      if (req.method === 'POST' && url.pathname === '/logout') {
        sessions.delete(sessionValue(req));
        res.setHeader('set-cookie', cookie('', 0)); res.setHeader('location', '/login'); return respond(303, 'Signed out.');
      }
      if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) return respond(413, 'Files must be 5 MB or smaller.');
      const chunks = []; let length = 0;
      for await (const bytes of req) {
        length += bytes.length;
        if (length > MAX_BODY) return respond(413, 'Files must be 5 MB or smaller.');
        chunks.push(bytes);
      }
      const body = Buffer.concat(chunks);
      if (req.method === 'POST' && url.pathname === '/login') {
        if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded') || body.length > 4096) return respond(400, 'Use the sign-in form.');
        if (now() - failureWindow > 15 * 60000) { failures = 0; failureWindow = now(); }
        const form = new URLSearchParams(body.toString());
        if (form.getAll('password').length !== 1 || !timingSafeEqual(hash(form.get('password') ?? ''), expectedPassword)) {
          failures++; return respond(failures > 20 ? 429 : 401, 'Sign in failed. Check the workspace password.');
        }
        for (const [token, expires] of sessions) if (expires <= now()) sessions.delete(token);
        if (sessions.size >= 64) return respond(429, 'Too many active sessions. Close an existing session first.');
        const value = Math.floor(now() / 1000) + '.' + randomBytes(24).toString('hex');
        const token = value + '.' + mac(value); sessions.set(token, now() + AGE * 1000);
        res.setHeader('set-cookie', cookie(token, AGE));
        res.setHeader('location', '/'); return respond(303, 'Signed in.');
      }
      if (!state.healthy) return respond(503, 'Saved storage needs attention. Restart from cloud state before continuing.');
      if (waiting >= 8) return respond(429, 'The workspace is busy. Please wait.');
      waiting++;
      const run = queue.then(async () => {
        try {
          await state.assertCurrent();
          const headers = { host: new URL(upstream).host, 'sec-fetch-site': 'same-origin' };
          // Authenticate and validate the public origin before translating to the loopback service.
          if (req.headers.origin) headers.origin = upstream;
          for (const name of ['content-type', 'x-mandate-csrf']) if (req.headers[name]) headers[name] = req.headers[name];
          const response = await fetch(new URL(url.pathname + url.search, upstream), {
            method: req.method, headers, ...(body.length ? { body } : {}), redirect: 'manual', signal: AbortSignal.timeout(240000),
          });
          let bytes = Buffer.from(await response.arrayBuffer());
          // Never return a prepared approval, submitted hash or completed plan before cloud durability.
          await state.persist();
          const type = response.headers.get('content-type') ?? 'application/octet-stream';
          if (type.startsWith('text/html')) {
            bytes = Buffer.from(bytes.toString().replace('</head>', '<link rel="stylesheet" href="/_hosted.css"></head>')
              .replace('<div class="shell">', '<div class="shell"><div class="hosted-bar"><span>Owner workspace</span><form method="post" action="/logout"><button type="submit">Sign out</button></form></div>'));
          }
          const resultHeaders = { 'content-type': type };
          const disposition = response.headers.get('content-disposition'); if (disposition) resultHeaders['content-disposition'] = disposition;
          res.writeHead(response.status, resultHeaders); res.end(bytes);
        } catch (error) {
          state.healthy = false; throw error;
        } finally { waiting--; }
      });
      queue = run.catch(() => {}); await run;
    } catch {
      if (!res.headersSent) respond(503, 'The workspace could not safely complete this request. Check saved state before retrying a payment.');
      else res.end();
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return { server, close: () => {
    if (!closePromise) {
      closing = true;
      const stopped = new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
      closePromise = Promise.all([queue, stopped]);
    }
    return closePromise;
  } };
}
