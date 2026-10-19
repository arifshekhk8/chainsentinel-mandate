import { ContractFactory, Interface, formatEther, formatUnits, getAddress, keccak256, toQuantity } from 'ethers';
import tokenArtifact from '../out/MandateDemoToken.sol/MandateDemoToken.json';
import vaultArtifact from '../out/MandateVault.sol/MandateVault.json';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state, csrf, account = null, current = null, busy = false;
const labels = { prepared: 'Review saved', wallet_requested: 'Wallet opened — check its original hash', submitted: 'Awaiting confirmations',
  confirmed: 'Confirmed', cancelled: 'Cancelled', reverted: 'Reverted', invalid: 'Not verified — inspect the transaction', outcome_unknown: 'Outcome unknown — check the original hash' };
const message = (text) => { $('#notice').textContent = text; };
async function api(route, body = null) {
  const r = await fetch(route, body === null ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-mandate-csrf': csrf }, body: JSON.stringify(body) });
  const result = await r.json(); if (!r.ok) throw new Error(result.error ?? 'The request could not be completed.'); return result;
}
function link(hash) {
  return state.chainId === 11155111 ? `<a href="https://sepolia.etherscan.io/tx/${esc(hash)}" target="_blank" rel="noopener noreferrer">${esc(hash)} ↗</a>` : esc(hash);
}
async function refresh() {
  const result = await api('/api/state'); csrf = result.csrf; state = result.setup;
  $('#network').textContent = state.network;
  $('#owner').textContent = state.owner; $('#agent').textContent = state.agent;
  $('#host').textContent = state.vendors['V-HOST']; $('#design').textContent = state.vendors['V-DESIGN'];
  $('#balance').textContent = `${state.ownerBalanceETH} test ETH`;
  $('#budget').textContent = `${state.reservedMaximumETH} / ${state.totalBudgetETH} test ETH maximum reserved`;
  $('#mode').textContent = state.allowWalletRequests ? 'Wallet requests enabled. Each action still needs review and your wallet confirmation.' : 'Review only. Public wallet requests are disabled.';
  const pending = state.intents.some((r) => !['confirmed', 'cancelled', 'reverted'].includes(r.status));
  $('#steps').innerHTML = state.steps.map((s, i) => `<li><div><strong>${i + 1}. ${esc(s.title)}</strong><span>${s.confirmed ? 'Confirmed' : 'Not confirmed'}</span></div><button data-prepare="${s.action}" ${busy || pending || s.confirmed || !state.steps.slice(0, i).every((p) => p.confirmed) ? 'disabled' : ''}>Review this action</button></li>`).join('');
  for (const b of document.querySelectorAll('[data-prepare]')) b.onclick = () => run(async () => show(await api('/api/prepare', { action: b.dataset.prepare })));
  $('#history').innerHTML = state.intents.map((r) => `<article><strong>${esc(r.payload.title)}</strong><p>${esc(labels[r.status] ?? r.status)}${r.error ? ` · ${esc(r.error)}` : ''}</p>
    ${r.hash ? `<p class="mono">${link(r.hash)}</p>` : ''}
    ${r.hash && !['confirmed', 'invalid', 'reverted'].includes(r.status) ? `<button data-recheck="${r.id}">Recheck original hash</button>` : ''}
    ${!r.hash && r.status === 'prepared' ? `<button data-view="${r.id}">Open saved review</button><button data-cancel="${r.id}">Cancel unsent review</button>` : ''}
    ${!r.hash && r.status === 'wallet_requested' ? `<label>Original hash from your wallet<input data-original="${r.id}" placeholder="0x…" autocomplete="off"></label><button data-record="${r.id}">Verify original hash</button>` : ''}</article>`).join('');
  for (const b of document.querySelectorAll('[data-recheck]')) b.onclick = () => run(async () => { const r = await api(`/api/intents/${b.dataset.recheck}/reconcile`, {}); message(`Original transaction: ${r.status}.`); });
  for (const b of document.querySelectorAll('[data-cancel]')) b.onclick = () => run(() => api(`/api/intents/${b.dataset.cancel}/cancel`, {}));
  for (const b of document.querySelectorAll('[data-view]')) b.onclick = () => show(state.intents.find((r) => r.id === b.dataset.view));
  for (const b of document.querySelectorAll('[data-record]')) b.onclick = () => run(() => api(`/api/intents/${b.dataset.record}/submitted`, { hash: document.querySelector(`[data-original="${b.dataset.record}"]`).value.trim() }));
  $('#ready').hidden = !state.ready;
}
function show(row) {
  current = row; const p = row.payload;
  $('#review-title').textContent = p.title;
  const effects = {
    token: `Create 1,000 MDT test tokens for owner ${state.owner}. MDT has no cash value.`,
    vault: `Create a paused vault. Per-bill limit 250 MDT; daily limit 400 MDT; protected reserve 300 MDT. Token: ${state.token}.`,
    deposit: `Transfer 1,000 MDT from the owner to vault ${state.vault}. This is test-token funding, not a supplier payment.`,
    host: `Allow fictional Hostline’s recipient ${state.vendors['V-HOST']} for future owner-approved bills.`,
    design: `Allow fictional Artline’s recipient ${state.vendors['V-DESIGN']} for future owner-approved bills.`,
    agent: `Grant restricted payment access to ${state.agent}. Access ends ${p.setupAction === 'agent' ? new Date(Number(p.args[2]) * 1000).toLocaleString() : ''} (your browser’s time). It cannot approve bills or change rules.`,
    gas: `Transfer 0.00005 Sepolia ETH to the separate agent ${state.agent} for test-payment gas.`,
  };
  const details = [['Network', `${state.network} · ${p.chainId}`], ['Owner', p.owner],
    ['What this does', effects[p.setupAction]], ['Destination', p.to ?? 'New contract'],
    ['Maximum wallet debit', `${p.fees.maximumOutflowETH} test ETH, including gas and any transfer`],
    ['Maximum fee', `${formatUnits(p.fees.maxFeePerGas, 9)} gwei · fixed ceiling 0.05 gwei`],
    ['Whole-demo limit', '0.001 Sepolia ETH; agent funding is included'], ['Confirmation rule', `${state.confirmations} confirmations before continuing`]];
  $('#details').innerHTML = details.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('');
  $('#calldata').textContent = JSON.stringify({ method: p.method, arguments: p.args, valueWei: p.value,
    dataHash: p.dataHash, gasLimit: p.fees.gasLimit, data: p.data }, null, 2);
  $('#reviewed').checked = false; $('#send').disabled = true; $('#review').showModal();
}
async function checkWallet() {
  if (!window.ethereum) throw new Error('Open this page in your browser with the owner wallet extension.');
  const addresses = await window.ethereum.request({ method: 'eth_accounts' });
  if (getAddress(addresses[0] ?? '') !== state.owner) throw new Error(`Select owner ${state.owner} in your wallet.`);
  if (Number(BigInt(await window.ethereum.request({ method: 'eth_chainId' }))) !== state.chainId) throw new Error(`Select ${state.network} (${state.chainId}) in your wallet.`);
}
async function run(work) {
  if (busy) return; busy = true;
  try { await work(); } catch (e) { message(e.message ?? 'The action stopped. Check the original transaction.'); }
  finally { busy = false; await refresh().catch((e) => message(e.message)); }
}
$('#connect').onclick = () => run(async () => {
  if (!window.ethereum) throw new Error('No browser wallet was found.');
  [account] = await window.ethereum.request({ method: 'eth_requestAccounts' }); await checkWallet();
  $('#connect').textContent = 'Owner wallet connected'; message('Connected on the expected network. No transaction was requested.');
});
$('#reviewed').onchange = () => { $('#send').disabled = !$('#reviewed').checked || !state.allowWalletRequests || busy; };
$('#close').onclick = () => { if (!busy) $('#review').close(); };
$('#review').addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
$('#send').onclick = () => run(async () => {
  if (!current || !$('#reviewed').checked || !state.allowWalletRequests) throw new Error('Review the action before opening your wallet.');
  $('#send').disabled = true; let hash = null, opened = false;
  try {
    await checkWallet(); const p = current.payload;
    if (keccak256(p.data) !== p.dataHash || BigInt(p.fees.maxFeePerGas) > 50000000n || p.owner !== state.owner || p.chainId !== state.chainId
      || BigInt(p.fees.gasLimit) * BigInt(p.fees.maxFeePerGas) + BigInt(p.value) > 1000000000000000n) throw new Error('The saved transaction review is invalid.');
    let expected;
    if (p.setupAction === 'token' || p.setupAction === 'vault') {
      const artifact = p.setupAction === 'token' ? tokenArtifact : vaultArtifact;
      expected = (await new ContractFactory(artifact.abi, artifact.bytecode.object).getDeployTransaction(...p.args)).data;
    } else if (p.setupAction === 'gas') {
      if (p.to !== state.agent || BigInt(p.value) !== 50000000000000n) throw new Error('Unexpected agent funding.'); expected = '0x';
    } else {
      const artifact = p.setupAction === 'deposit' ? tokenArtifact : vaultArtifact;
      if (p.to !== (p.setupAction === 'deposit' ? state.token : state.vault) || BigInt(p.value) !== 0n) throw new Error('Unexpected setup destination.');
      expected = new Interface(artifact.abi).encodeFunctionData(p.method, p.args);
    }
    if (expected.toLowerCase() !== p.data.toLowerCase()) throw new Error('The transaction data does not match the reviewed action.');
    const checked = await api(`/api/intents/${current.id}/validate`, {}); opened = true;
    if (checked.payload.dataHash !== p.dataHash) throw new Error('The review changed. Stop and inspect it.');
    message('Review this exact transaction in your wallet. Do not edit its gas limits or fees.');
    hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: state.owner,
      ...(p.to ? { to: p.to } : {}), data: p.data, value: toQuantity(p.value), chainId: toQuantity(p.chainId),
      gas: toQuantity(p.fees.gasLimit), maxFeePerGas: toQuantity(p.fees.maxFeePerGas), maxPriorityFeePerGas: toQuantity(p.fees.maxPriorityFeePerGas) }] });
    message(`Original transaction ${hash}. Waiting for ${state.confirmations} confirmations; do not resend.`);
    let result = await api(`/api/intents/${current.id}/submitted`, { hash });
    for (let i = 0; i < 24 && result.status === 'submitted'; i++) {
      await new Promise((r) => setTimeout(r, state.chainId === 11155111 ? 4000 : 100));
      result = await api(`/api/intents/${current.id}/reconcile`, {});
    }
    message(`Setup transaction: ${result.status}. ${result.status === 'confirmed' ? 'The matching receipt was verified.' : 'Recheck the original hash in history.'}`);
  } catch (e) {
    if (opened && !hash && (e.code === 4001 || e.code === 'ACTION_REJECTED')) await api(`/api/intents/${current.id}/cancel`, { walletRejected: true });
    else if (opened) message(hash ? `Check original hash ${hash}; do not resend.` : 'Check your wallet history for the original hash. This action remains locked.');
    throw e;
  } finally { $('#review').close(); }
});
$('#refresh').onclick = () => run(async () => {});
refresh().catch((e) => message(e.message));
