import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { ContractFactory, JsonRpcProvider, Wallet, getAddress, id, keccak256, parseEther, parseUnits } from 'ethers';
import { foundryBinary } from './foundry.mjs';
import { newInstanceId } from '../app/service.mjs';

export async function startLocalChain({ port = 0, ownerAddress = null } = {}) {
  const root = new URL('../', import.meta.url);
  const build = spawnSync(foundryBinary('forge'), ['build', '--quiet'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) throw new Error('Contract build failed; run npm run build for details.');
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(port, '127.0.0.1', resolve); });
  port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(foundryBinary('anvil'), ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337',
    '--accounts', '5', '--hardfork', 'cancun', '--quiet', '--allow-origin', 'http://127.0.0.1:4173'], { stdio: 'ignore' });
  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, undefined, { cacheTimeout: -1 });
  provider.pollingInterval = 50;
  const close = async () => {
    provider.destroy();
    if (child.exitCode === null && !spawnError) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      await exited; clearTimeout(timer);
    }
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (spawnError || child.exitCode !== null) throw new Error('Local chain could not start; its port may already be in use.');
      try {
        const response = await fetch(`http://127.0.0.1:${port}`, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(500) });
        if ((await response.json()).result === '0x7a69') { ready = true; break; }
      } catch {}
      await delay(50);
    }
    if (!ready) throw new Error('Local chain timed out.');
    const [deployer, host, design, stranger] = await Promise.all([0, 2, 3, 4].map((i) => provider.getSigner(i)));
    // Separate ephemeral agent key stays in memory and can pre-sign/hash before broadcast.
    const agent = Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [await agent.getAddress(), `0x${parseEther('10').toString(16)}`]);
    const owner = ownerAddress ? getAddress(ownerAddress) : await deployer.getAddress();
    const artifact = async (name) => JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root)));
    const tokenArtifact = await artifact('MandateDemoToken');
    const vaultArtifact = await artifact('MandateVault');
    const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode.object, deployer).deploy(await deployer.getAddress(), parseUnits('1000', 6));
    await token.waitForDeployment();
    const vault = await new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode.object, deployer).deploy(owner, await token.getAddress(), parseUnits('250', 6), parseUnits('400', 6), parseUnits('300', 6));
    await vault.waitForDeployment();
    await (await token.transfer(await vault.getAddress(), parseUnits('1000', 6))).wait();
    // Local-only impersonation seeds demo configuration for an optional public owner address.
    // It is not a real wallet signature, uses no owner secret and cannot run on a public chain.
    if (ownerAddress) {
      await provider.send('anvil_setBalance', [owner, `0x${parseEther('100').toString(16)}`]);
      await provider.send('anvil_impersonateAccount', [owner]);
    }
    const ownerSigner = ownerAddress ? await provider.getSigner(owner) : deployer;
    const ownerVault = vault.connect(ownerSigner);
    await (await ownerVault.setVendor(id('V-HOST'), await host.getAddress(), true)).wait();
    await (await ownerVault.setVendor(id('V-DESIGN'), await design.getAddress(), true)).wait();
    const now = (await provider.getBlock('latest')).timestamp;
    await (await ownerVault.setAgent(await agent.getAddress(), now, now + 86400)).wait();
    if (ownerAddress) await provider.send('anvil_stopImpersonatingAccount', [owner]);
    const config = { chainId: 31337, rpcUrl: `http://127.0.0.1:${port}`, instanceId: newInstanceId(),
      vaultAddress: await vault.getAddress(), tokenAddress: await token.getAddress(), ownerAddress: owner,
      vaultCodeHash: keccak256(await provider.getCode(await vault.getAddress())),
      tokenCodeHash: keccak256(await provider.getCode(await token.getAddress())) };
    return { config, provider, vault: ownerVault, token, owner: ownerSigner, agent, host, design, stranger,
      vaultAbi: vaultArtifact.abi, tokenAbi: tokenArtifact.abi, close };
  } catch (error) { await close(); throw error; }
}
