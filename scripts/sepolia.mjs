import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Store } from '../app/store.mjs';
import { OwnerService } from '../app/service.mjs';
import { AgentService } from '../app/agent.mjs';
import { createModel } from '../app/model.mjs';
import { startServer } from '../app/server.mjs';
import { SetupService } from '../app/setup.mjs';
import { AppError, check } from '../app/errors.mjs';
import { SEPOLIA } from '../app/sepolia-policy.mjs';
import { DATA_DIRECTORY, DEFAULT_RPC, initializeSetup, loadSetup, publicProvider, readArtifacts } from './sepolia-config.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
process.umask(0o077);
const args = process.argv.slice(2);
let store, service, app, lockOwned = false;
const lock = resolve(DATA_DIRECTORY, 'process.lock');
function release() { if (lockOwned) { unlinkSync(lock); lockOwned = false; } }
try {
  check(args.every((a, i) => ['--setup', '--app', '--export', '--allow-wallet', '--owner'].includes(a)
    || i > 0 && args[i - 1] === '--owner'), 'Use --setup [--owner PUBLIC_ADDRESS] [--allow-wallet], --app, or --export.');
  check(args.filter((a) => ['--setup', '--app', '--export'].includes(a)).length === 1,
    'Choose exactly one mode: --setup, --app or --export.');
  check(!args.includes('--allow-wallet') || args.includes('--setup'), 'Only deployment setup accepts --allow-wallet.');
  const owner = args.includes('--owner') ? args[args.indexOf('--owner') + 1] : null;
  check(owner || existsSync(resolve(DATA_DIRECTORY, 'setup.json')), 'First run npm run sepolia:setup -- --owner YOUR_PUBLIC_ADDRESS.');
  const loaded = owner ? initializeSetup(owner) : loadSetup();
  mkdirSync(DATA_DIRECTORY, { recursive: true, mode: 0o700 });
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    check(Number.isSafeInteger(pid) && pid > 0, 'Inspect the saved Sepolia process lock.');
    let live = true; try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') live = false; }
    check(!live, 'A Sepolia setup/app process is already active. Stop it before switching modes.', 409); unlinkSync(lock);
  }
  writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 }); lockOwned = true;
  const built = spawnSync(process.execPath, ['scripts/build-app.mjs'], { encoding: 'utf8' });
  check(built.status === 0, 'The browser build failed. Run npm run build:app for details.');
  const artifacts = readArtifacts(), rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC;
  store = new Store(resolve(DATA_DIRECTORY, 'mandate.sqlite'));
  service = new SetupService({ seed: loaded.seed, store, provider: publicProvider(rpcUrl), artifacts, allowWalletRequests: args.includes('--allow-wallet') });
  await service.network(); // Reject every network except Sepolia before exposing the UI.
  if (args.includes('--export')) {
    const config = await service.configuration(rpcUrl);
    const records = store.intents().filter((r) => r.payload.chainId === SEPOLIA && r.hash);
    for (const r of records) {
      const receipt = await service.provider.getTransactionReceipt(r.hash);
      check(receipt && await receipt.confirmations() >= 2 && receipt.blockHash === r.receipt?.blockHash,
        'An original receipt is missing or changed. Reconcile it before exporting evidence.');
    }
    const recordedAt = new Date().toISOString(), target = `evidence/step5-sepolia-${recordedAt.replace(/[:.]/g, '-')}.json`;
    const { rpcUrl: omitted, ...publicConfig } = config;
    const result = { evidenceType: 'public-sepolia-execution', publicTestnetEvidence: true, recordedAt,
      realWalletExtensionTested: false, liveModelUsed: store.plans(config.instanceId).some((p) => p.payload.mode?.startsWith('live-')),
      config: publicConfig, explorer: 'https://sepolia.etherscan.io', ownerIntents: records,
      plans: store.plans(config.instanceId), payments: store.payments(config.instanceId),
      limits: 'Synthetic test tokens only; two confirmations are not an absolute finality guarantee. Extension operation must be verified separately.' };
    writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(`Saved verified public receipts to ${target}. RPC credentials and agent keys are excluded.`);
    service.close(); store.close(); release();
  } else {
    if (args.includes('--app')) {
      const config = await service.configuration(rpcUrl); service.close();
      service = new OwnerService(config, store, artifacts.vault.abi, artifacts.token.abi, publicProvider(rpcUrl));
      service.agent = new AgentService(service, createModel(), loaded.agent.connect(service.provider));
      await service.snapshot(); await service.agent.executor.recover();
      app = await startServer(service);
      console.log(`Sepolia owner review: ${app.origin}. Existing approvals persist. Nothing is sent automatically.`);
    } else {
      app = await startServer(service, { port: 4174, publicDir: new URL('../dist/setup/', import.meta.url) });
      console.log(`Sepolia deployment review: ${app.origin}. ${args.includes('--allow-wallet') ? 'Owner wallet requests enabled.' : 'REVIEW ONLY — wallet sending is disabled.'}`);
    }
    console.log('Total maximum reviewed owner outflow: 0.001 Sepolia ETH. Agent funding: 0.00005. Fee cap: 0.05 gwei.');
    console.log(`Owner: ${loaded.seed.ownerAddress}. Separate agent: ${loaded.seed.agentAddress}. Never enter an owner key.`);
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; await app.close(); service.close(); store.close(); release(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  }
} catch (error) {
  await app?.close(); service?.close(); store?.close(); release();
  console.error(error instanceof AppError ? error.message : 'Sepolia startup stopped safely. Check private local configuration and the configured RPC. No automatic retry occurred.');
  process.exitCode = 1;
}
