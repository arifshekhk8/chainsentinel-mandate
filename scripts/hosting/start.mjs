import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Wallet } from 'ethers';
import { Store } from '../../app/store.mjs';
import { OwnerService } from '../../app/service.mjs';
import { AgentService } from '../../app/agent.mjs';
import { createModel } from '../../app/model.mjs';
import { startServer } from '../../app/server.mjs';
import { publicProvider, readArtifacts } from '../sepolia-config.mjs';
import { CloudState, durableProvider } from './persistence.mjs';
import { neonRepository } from './neon.mjs';
import { startGateway } from './gateway.mjs';
import { readFileSync } from 'node:fs';

export async function startHosted(env = process.env) {
  process.umask(0o077);
  if (env.AI_PROVIDER !== 'groq' || env.GROQ_MODEL !== 'openai/gpt-oss-120b') throw new Error('Hosted AI must explicitly select the approved Groq provider and model.');
  const origin = env.RENDER_EXTERNAL_URL || env.MANDATE_PUBLIC_ORIGIN;
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.pathname !== '/' || parsedOrigin.username || parsedOrigin.password
    || parsedOrigin.search || parsedOrigin.hash || ['MANDATE_OWNER_PASSWORD', 'MANDATE_SESSION_SECRET', 'MANDATE_STORAGE_SECRET']
      .some((key) => typeof env[key] !== 'string' || env[key].length < 32)) throw new Error('Configure HTTPS and private hosting secrets first.');
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Configure a valid listening port.');
  const publicExport = JSON.parse(readFileSync(new URL('../../evidence/sepolia/public/step5-sepolia-2026-10-19T15-52-14-777Z.json', import.meta.url)));
  const config = { ...publicExport.config, rpcUrl: env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com' };
  const artifacts = readArtifacts();
  const path = join(mkdtempSync(join(tmpdir(), 'mandate-hosted-')), 'mandate.sqlite');
  const state = new CloudState({ repository: neonRepository(env.DATABASE_URL), secret: env.MANDATE_STORAGE_SECRET,
    workspace: 'mandate-sepolia-owner-v1', path });
  let store, service, inner, gateway;
  try {
    const agent = new Wallet(env.MANDATE_AGENT_PRIVATE_KEY);
    if (agent.address.toLowerCase() === config.ownerAddress.toLowerCase()
      || agent.address.toLowerCase() !== '0xe9987a361f8286c396b0519aec3ab5d29f4553a4') throw new Error('Use only the existing restricted test-agent key, never an owner key.');
    await state.restore();
    store = new Store(path);
    if (store.db.prepare('PRAGMA journal_mode').get().journal_mode !== 'delete') throw new Error('Hosted storage requires DELETE journal mode.');
    // An atomic revision advance fences earlier hosted instances before any recovery or RPC.
    // Their next write/broadcast fence fails. Original pending hashes remain in this snapshot.
    await state.persist({ force: true });
    for (const plan of store.plans(config.instanceId).filter((p) => p.status === 'running')) store.finishPlan(plan.id, 'interrupted');
    const provider = durableProvider(publicProvider(config.rpcUrl), state);
    service = new OwnerService(config, store, artifacts.vault.abi, artifacts.token.abi, provider);
    service.agent = new AgentService(service, createModel(env), agent.connect(provider));
    await service.snapshot();
    await service.agent.executor.recover();
    await state.persist();
    inner = await startServer(service, { port: 0 });
    gateway = await startGateway({ upstream: inner.origin, publicOrigin: origin, password: env.MANDATE_OWNER_PASSWORD,
      sessionSecret: env.MANDATE_SESSION_SECRET, state, port });
    console.log('Mandate protected Sepolia workspace is ready. No AI request or transaction was sent during startup.');
    return { state, service, store, gateway, close: async () => {
      try { await gateway.close(); await state.persist(); }
      finally { await inner.close(); service.close(); store.close(); }
    } };
  } catch (error) {
    await gateway?.close(); await inner?.close(); service?.close(); store?.close(); throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const hosted = await startHosted();
    let closing = false;
    const stop = async () => { if (closing) return; closing = true; try { await hosted.close(); } catch { process.exitCode = 1; } };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } catch {
    console.error('Hosted startup stopped safely. Check private hosting settings and cloud storage. No automatic transaction retry occurred.');
    process.exitCode = 1;
  }
}
