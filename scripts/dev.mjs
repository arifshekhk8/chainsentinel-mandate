import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { startLocalChain } from './local-chain.mjs';
import { OwnerService } from '../app/service.mjs';
import { Store } from '../app/store.mjs';
import { startServer } from '../app/server.mjs';
import { OpenAIModel } from '../app/model.mjs';
import { AgentService } from '../app/agent.mjs';
import { existsSync } from 'node:fs';

// Node's own dotenv parser; secrets are never printed or served to the browser.
if (existsSync(new URL('../.env', import.meta.url))) process.loadEnvFile(new URL('../.env', import.meta.url));

const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--owner')) throw new Error('Usage: npm run dev [-- --owner PUBLIC_WALLET_ADDRESS]');
const built = spawnSync(process.execPath, [new URL('./build-app.mjs', import.meta.url).pathname], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);
process.umask(0o077);
const chain = await startLocalChain({ port: 8545, ownerAddress: args[1] });
const store = new Store(new URL('../local-data/mandate.sqlite', import.meta.url).pathname);
const service = new OwnerService(chain.config, store, chain.vaultAbi, chain.tokenAbi);
service.agent = new AgentService(service, new OpenAIModel(), chain.agent);
let app;
try {
  app = await startServer(service);
  await service.agent.executor.recover();
  await mkdir(new URL('../local-data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../local-data/deployment.json', import.meta.url), `${JSON.stringify(chain.config, null, 2)}\n`, { mode: 0o600 });
  console.log(`Mandate owner review: ${app.origin}`);
  console.log(`LOCAL TEST CHAIN ONLY. AI mode: ${service.agent.model.mode}. Separate test agent connected.`);
  console.log(`Local owner address: ${chain.config.ownerAddress}`);
  console.log('Connect a browser wallet on chain 31337 only when you choose to test signing.');
  if (!args[1]) console.log('For your existing browser account: restart with npm run dev -- --owner YOUR_PUBLIC_ADDRESS (no private key).');
} catch (error) { service.close(); store.close(); await chain.close(); throw error; }
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  await app.close(); service.close(); store.close(); await chain.close();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
