import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { ContractFactory, JsonRpcProvider, id, parseUnits } from 'ethers';
import { billKeyFor, invoiceIdHash } from './bill-identity.mjs';
import { foundryBinary } from './foundry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// Rebuild with the pinned normal profile; coverage/debug commands can leave different artifacts.
const build = spawnSync(foundryBinary('forge'), ['build', '--quiet'], { cwd: root, encoding: 'utf8' });
assert.equal(build.status, 0, 'Contract build failed; run npm run build for details');
const fixtureBytes = await readFile(new URL('../demo/cases.json', import.meta.url));
const fixtures = JSON.parse(fixtureBytes);
const referenceTime = Math.floor(Date.parse(fixtures.reference_time_utc) / 1000);
const artifact = async (name) => JSON.parse(await readFile(new URL(`../out/${name}.sol/${name}.json`, import.meta.url)));
const tokenArtifact = await artifact('MandateDemoToken');
const vaultArtifact = await artifact('MandateVault');
assert(vaultArtifact.metadata.compiler.version.startsWith('0.8.37+'), 'Unexpected Solidity compiler');
assert.equal(vaultArtifact.metadata.settings.optimizer.enabled, true, 'Unexpected compiler profile');
const amount = (value) => parseUnits(value, 6);
const unit = (value) => amount(String(value));

// Choose a free loopback port. Never read a user-supplied RPC URL or use a browser wallet.
const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const node = spawn(foundryBinary('anvil'), [
  '--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337', '--accounts', '4',
  '--hardfork', 'cancun', '--timestamp', String(referenceTime), '--no-cors', '--quiet',
], { cwd: root, stdio: 'ignore' });
let spawnError;
node.on('error', (error) => { spawnError = error; });
const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, undefined, { cacheTimeout: -1 });
provider.pollingInterval = 50;
const stop = () => node.kill('SIGTERM');
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError || node.exitCode !== null) throw new Error('Local Anvil could not start');
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: AbortSignal.timeout(500),
      });
      const rpc = await response.json();
      assert.equal(rpc.result, '0x7a69');
      ready = true;
      break;
    } catch { await delay(50); }
  }
  assert(ready, 'Timed out starting the local chain');
  assert.equal((await provider.getNetwork()).chainId, 31337n);
  const [owner, agent, host, design] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));
  const addresses = {
    owner: await owner.getAddress(), agent: await agent.getAddress(),
    host: await host.getAddress(), design: await design.getAddress(),
  };
  const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode.object, owner)
    .deploy(addresses.owner, unit(1000));
  const tokenDeployment = await token.deploymentTransaction().wait();
  const tokenAddress = await token.getAddress();
  const vault = await new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode.object, owner)
    .deploy(addresses.owner, tokenAddress, unit(250), unit(400), unit(300));
  const vaultDeployment = await vault.deploymentTransaction().wait();
  const vaultAddress = await vault.getAddress();
  const agentVault = vault.connect(agent);
  const confirmed = async (pending) => {
    const receipt = await (await pending).wait();
    assert.equal(receipt.status, 1);
    return receipt;
  };
  const funding = await confirmed(token.transfer(vaultAddress, unit(1000)));
  await confirmed(vault.setVendor(id('V-HOST'), addresses.host, true));
  await confirmed(vault.setVendor(id('V-DESIGN'), addresses.design, true));
  await confirmed(vault.setAgent(addresses.agent, referenceTime, referenceTime + 86400));

  const chosen = fixtures.demo_bills.filter((bill) => ['D01', 'D02', 'D03'].includes(bill.id));
  const plans = chosen.map((bill) => ({
    bill,
    key: billKeyFor(31337, vaultAddress, id(bill.vendor_reference), bill.invoice_number),
    approval: {
      vendorId: id(bill.vendor_reference), invoiceIdHash: invoiceIdHash(bill.invoice_number),
      recipient: bill.recipient_alias === 'HOST_APPROVED' ? addresses.host : addresses.design,
      amount: amount(bill.amount),
      notBefore: Math.floor(Date.parse(bill.not_before) / 1000),
      expiresAt: Math.floor(Date.parse(bill.expires_at) / 1000),
      documentHash: id(JSON.stringify(bill)),
    },
  }));
  for (const plan of plans) assert.equal(await vault.billKeyFor(plan.approval.vendorId, plan.approval.invoiceIdHash), plan.key);
  const approvalReceipt = await confirmed(vault.approveBills(plans.map((p) => p.approval)));
  await confirmed(vault.setPaused(false));
  const version = await vault.policyVersion();
  const receipts = [];

  // Scripted calls, not an AI evaluation or dashboard workflow.
  for (const plan of plans.slice(0, 2)) {
    await agentVault.payBill.staticCall(plan.key, version);
    const receipt = await confirmed(agentVault.payBill(plan.key, version));
    assert.equal(receipt.to.toLowerCase(), vaultAddress.toLowerCase());
    assert.equal((await provider.getTransaction(receipt.hash)).chainId, 31337n);
    const paymentLogs = receipt.logs.filter((log) => log.address.toLowerCase() === vaultAddress.toLowerCase())
      .map((log) => vault.interface.parseLog(log)).filter((log) => log?.name === 'BillPaid');
    const transferLogs = receipt.logs.filter((log) => log.address.toLowerCase() === tokenAddress.toLowerCase())
      .map((log) => token.interface.parseLog(log)).filter((log) => log?.name === 'Transfer');
    assert.equal(paymentLogs.length, 1);
    assert.equal(transferLogs.length, 1);
    const event = paymentLogs[0].args;
    assert.equal(event.billKey, plan.key);
    assert.equal(event.recipient, plan.approval.recipient);
    assert.equal(event.token, tokenAddress);
    assert.equal(event.amount, plan.approval.amount);
    assert.equal(event.policyVersion, version);
    assert.equal(transferLogs[0].args.from, vaultAddress);
    assert.equal(transferLogs[0].args.to, plan.approval.recipient);
    assert.equal(transferLogs[0].args.value, plan.approval.amount);
    assert.equal((await vault.getBill(plan.key)).paid, true);
    const block = await provider.getBlock(receipt.blockNumber);
    assert.equal(event.utcDay, BigInt(Math.floor(block.timestamp / 86400)));
    receipts.push({
      billId: plan.bill.id, billKey: plan.key, recipient: event.recipient,
      amountBaseUnits: event.amount.toString(), token: event.token,
      policyVersion: event.policyVersion.toString(), dailySpentBaseUnits: event.dailySpent.toString(),
      transactionHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash,
      status: receipt.status, gasUsed: receipt.gasUsed.toString(),
      gasCostWei: receipt.fee.toString(), logs: receipt.logs.map((log) => ({ address: log.address, topics: log.topics, data: log.data })),
    });
  }

  const expectReason = async (key, expected) => {
    try { await agentVault.payBill.staticCall(key, version); }
    catch (error) {
      const name = error.revert?.name ?? vault.interface.parseError(error.data)?.name;
      assert.equal(name, expected);
      return;
    }
    assert.fail(`Expected ${expected}`);
  };
  const duplicateKey = billKeyFor(31337, vaultAddress, id('V-HOST'), '  host-1001  ');
  assert.equal(duplicateKey, plans[0].key);
  await expectReason(duplicateKey, 'BillAlreadyPaid');
  await expectReason(plans[2].key, 'DailyLimitExceeded');

  // Mine a real local reverted transaction; a simulation result alone is not a receipt.
  const deniedTx = await agentVault.payBill(plans[2].key, version, { gasLimit: 300000 });
  let deniedReceipt;
  try { await deniedTx.wait(); assert.fail('Daily-limit transaction unexpectedly succeeded'); }
  catch (error) { deniedReceipt = error.receipt; }
  assert(deniedReceipt, 'Missing mined reverted receipt');
  assert.equal(deniedReceipt.status, 0);
  assert.equal(deniedReceipt.logs.length, 0);
  assert.equal((await vault.getBill(plans[2].key)).paid, false);
  assert.equal(await token.balanceOf(vaultAddress), unit(650));
  assert.equal(await token.balanceOf(addresses.host), unit(200));
  assert.equal(await token.balanceOf(addresses.design), unit(150));
  assert.equal(await vault.currentDaySpent(), unit(350));
  assert.equal(await vault.dailyLimit() - await vault.currentDaySpent(), unit(50));

  const evidence = {
    evidenceType: 'local-anvil-only', mode: 'scripted-no-model', chainId: 31337,
    publicTestnetEvidence: false, persistentChain: false,
    notice: 'Ephemeral local execution. Hashes cannot be verified on Sepolia/Etherscan. Re-run the script to reproduce.',
    recordedAt: new Date().toISOString(), fixtureVersion: fixtures.version,
    fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'),
    toolVersions: { forge: '1.7.1', anvil: '1.7.1', solc: '0.8.37', openzeppelin: '5.6.1', ethers: '6.17.0', node: process.version },
    contracts: { token: tokenAddress, vault: vaultAddress }, accounts: addresses,
    deploymentHashes: { token: tokenDeployment.hash, vault: vaultDeployment.hash },
    fundingHash: funding.hash, approvalHash: approvalReceipt.hash,
    openingBalanceBaseUnits: unit(1000).toString(), payments: receipts,
    blocked: {
      duplicate: { billKey: duplicateKey, reason: 'BillAlreadyPaid', checkedBy: 'eth_call' },
      dailyLimit: { billId: 'D03', reason: 'DailyLimitExceeded', transactionHash: deniedReceipt.hash,
        blockNumber: deniedReceipt.blockNumber, blockHash: deniedReceipt.blockHash,
        status: deniedReceipt.status, gasUsed: deniedReceipt.gasUsed.toString(), logs: [] },
    },
    finalState: { paidBaseUnits: unit(350).toString(), vaultBalanceBaseUnits: unit(650).toString(),
      remainingDailyBudgetBaseUnits: unit(50).toString(), hostBalanceBaseUnits: unit(200).toString(), designBalanceBaseUnits: unit(150).toString() },
  };
  await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await writeFile(new URL('../evidence/step2-local-demo.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log('LOCAL ONLY: paid 350 MDT; balance 650 MDT; daily budget left 50 MDT.');
  console.log('Verified two payment receipts, duplicate protection, and one mined daily-limit rejection.');
  console.log('Saved evidence/step2-local-demo.json. No model, browser wallet, Sepolia or real funds used.');
} finally {
  provider.destroy();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  if (node.exitCode === null && !spawnError) {
    const exited = new Promise((resolve) => node.once('exit', resolve));
    node.kill('SIGTERM');
    let timer;
    await Promise.race([exited, new Promise((resolve) => { timer = setTimeout(() => { node.kill('SIGKILL'); resolve(); }, 2000); })]);
    clearTimeout(timer);
  }
}
