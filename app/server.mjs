import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AppError, check } from './errors.mjs';
import { MAX_FILE_BYTES, parseUpload } from './intake.mjs';
import { sampleCsv, samplePdf } from './samples.mjs';

const MAX_BODY = MAX_FILE_BYTES + 65536;
export async function startServer(service, { port = 4173, publicDir = new URL('../dist/', import.meta.url) } = {}) {
  const csrf = randomBytes(32).toString('hex');
  let origin;
  let uploading = false;
  let closing = false, closePromise;
  const sockets = new Set(), requested = new WeakSet();
  const server = createServer(async (req, res) => {
    requested.add(req.socket);
    const json = (status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      check(req.headers.host === new URL(origin).host, 'Unexpected host.', 403);
      check(!req.headers.origin || req.headers.origin === origin, 'Cross-origin access is not allowed.', 403);
      check(req.headers['sec-fetch-site'] !== 'cross-site', 'Cross-site access is not allowed.', 403);
      const url = new URL(req.url, origin);
      check(url.origin === origin, 'Unexpected origin.', 403);
      const route = url.pathname;
      if (service.setupOnly) check(req.method === 'GET' && ['/', '/app.js', '/app.css', '/api/state'].includes(route)
        || req.method === 'POST' && (route === '/api/prepare' || /^\/api\/intents\/[\w-]+\/(validate|submitted|reconcile|cancel)$/.test(route)),
      'This setup screen only supports the reviewed deployment actions.', 404);
      if (!['GET', 'HEAD'].includes(req.method)) {
        const token = Buffer.from(String(req.headers['x-mandate-csrf'] ?? ''));
        check(req.headers.origin === origin && token.length === csrf.length && timingSafeEqual(token, Buffer.from(csrf)), 'Refresh the page before changing local data.', 403);
      }
      if (req.method === 'GET' && route === '/api/state') return json(200, { ...await service.state(), csrf });
      if (req.method === 'GET' && route === '/api/sample.csv') {
        res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="mandate-demo-bills.csv"' });
        return res.end(sampleCsv(await service.snapshot()));
      }
      if (req.method === 'GET' && route === '/api/sample.pdf') {
        const bytes = await samplePdf(await service.snapshot());
        res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="mandate-hosting-demo.pdf"' });
        return res.end(bytes);
      }
      if (req.method === 'GET') {
        const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'application/javascript'], '/app.css': ['app.css', 'text/css'] };
        check(Object.hasOwn(files, route), 'Not found.', 404);
        const [name, type] = files[route];
        const data = await readFile(new URL(name, publicDir));
        res.writeHead(200, { 'content-type': type }); return res.end(data);
      }
      check(['POST', 'PATCH', 'DELETE'].includes(req.method), 'Method not allowed.', 405);
      check(!Number(req.headers['content-length']) || Number(req.headers['content-length']) <= MAX_BODY, 'Files must be 5 MB or smaller.', 413);
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; check(size <= MAX_BODY, 'Files must be 5 MB or smaller.', 413); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      if (req.method === 'POST' && route === '/api/upload') {
        check(!uploading, 'Another file is being processed. Please wait.', 409);
        check(/^multipart\/form-data;/.test(req.headers['content-type'] ?? ''), 'Upload a file using the file chooser.');
        uploading = true;
        try {
          const form = await new Request(origin, { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: bytes }).formData();
          const file = form.get('file');
          check([...form.keys()].length === 1 && file instanceof File, 'Choose one file per upload.');
          const document = await parseUpload(file.name, Buffer.from(await file.arrayBuffer()));
          return json(201, { documentId: service.store.importDocument(document) });
        } finally { uploading = false; }
      }
      let body = {};
      if (bytes.length) {
        check(req.headers['content-type']?.startsWith('application/json') && bytes.length <= 100000, 'Use a small JSON request.');
        try { body = JSON.parse(bytes); } catch { throw new AppError('Malformed JSON.'); }
        check(body && typeof body === 'object' && !Array.isArray(body), 'Expected a JSON object.');
      }
      let match;
      if (route.startsWith('/api/agent/')) {
        check(service.agent, 'Agent workflow is not connected.', 503);
        if (route === '/api/agent/request' && req.method === 'POST') return json(201, await service.agent.request(body));
        if (route === '/api/agent/preview' && req.method === 'POST') return json(201, await service.agent.preview());
        if ((match = route.match(/^\/api\/agent\/extract\/([\w-]+)$/)) && req.method === 'POST') return json(201, await service.agent.extract(match[1]));
        if ((match = route.match(/^\/api\/agent\/plans\/([\w-]+)\/(apply|execute)$/)) && req.method === 'POST') {
          return json(200, match[2] === 'apply' ? await service.agent.apply(match[1]) : await service.agent.execute(match[1], body));
        }
        if ((match = route.match(/^\/api\/agent\/payments\/([\w-]+)\/reconcile$/)) && req.method === 'POST') return json(200, await service.agent.executor.reconcile(match[1]));
      }
      if ((match = route.match(/^\/api\/drafts\/([\w-]+)$/)) && req.method === 'PATCH') return json(200, await service.editDraft(match[1], body));
      if ((match = route.match(/^\/api\/drafts\/([\w-]+)\/review$/)) && req.method === 'POST') { await service.reviewDraft(match[1], body); return json(200, { reviewed: true }); }
      if ((match = route.match(/^\/api\/documents\/([\w-]+)$/)) && req.method === 'DELETE') {
        const locked = (await service.assessAll()).some((row) => row.document_id === match[1] && row.locked);
        check(!locked, 'Reconcile the pending transaction before removing its source.', 409);
        service.store.deleteDocument(match[1]); return json(200, { deleted: true, retained: 'Opaque on-chain references and transaction history remain.' });
      }
      if (route === '/api/prepare' && req.method === 'POST') return json(201, await service.prepare(body.action, body));
      if ((match = route.match(/^\/api\/intents\/([\w-]+)\/(validate|submitted|reconcile|cancel)$/)) && req.method === 'POST') {
        const [, id, action] = match;
        if (action === 'validate') return json(200, await service.validateIntent(id));
        if (action === 'submitted') return json(200, await service.submitted(id, body.hash));
        if (action === 'reconcile') return json(200, await service.reconcile(id));
        return json(200, service.cancelIntent(id, body));
      }
      throw new AppError('Not found.', 404);
    } catch (error) {
      if (!res.headersSent) json(error instanceof AppError ? error.status : 500,
        { error: error instanceof AppError ? error.message : 'Could not complete this request. Refresh and check the configured network.' });
      else res.end();
    }
  });
  server.on('connection', (socket) => {
    if (closing) { socket.destroy(); return; }
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, close: () => {
    if (!closePromise) {
      closing = true;
      closePromise = new Promise((resolve) => server.close(resolve));
      // Browser preconnections have no HTTP request, so Node's HTTP idle reaper misses them.
      // Active requests keep their sockets and finish normally before the close promise resolves.
      for (const socket of sockets) if (!requested.has(socket)) socket.destroy();
      server.closeIdleConnections();
    }
    return closePromise;
  } };
}
