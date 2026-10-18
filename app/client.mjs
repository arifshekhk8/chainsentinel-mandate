import { BrowserProvider, Interface, formatUnits } from 'ethers';
import vaultArtifact from '../out/MandateVault.sol/MandateVault.json';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (value) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
const units = (value) => formatUnits(value ?? '0', 6).replace(/\.0$/, '');
const date = (value) => value || 'Needs review';
const localTime = (iso) => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
const isoTime = (value) => value ? new Date(value).toISOString() : '';
const labels = { needs_review: 'Needs review', draft: 'Draft', ready: 'Ready to approve', approved: 'Approved',
  submitted: 'Awaiting confirmation', outcome_unknown: 'Outcome unknown', recorded_paid: 'Contract marks paid',
  confirmed: 'Confirmed', invalid: 'Not verified', reverted: 'Reverted', prepared: 'Not submitted', cancelled: 'Cancelled' };
const iface = new Interface(vaultArtifact.abi);
let state, csrf, account = null, provider = null, wallet = null, intent = null, signing = false;
let currentDraft = null;
let reviewGeneration = 0;
let agentBusy = false;
let activePlanId = null;
const selected = new Set();

function notify(message, error = false) {
  $('#notice').hidden = false; $('#notice').textContent = message;
  $('#notice').className = error ? 'error' : '';
}
function report(error) { notify(error.message ?? 'Something went wrong. Refresh and check the local chain.', true); }
async function api(path, method = 'GET', body = null) {
  const options = { method, headers: {} };
  if (method !== 'GET') options.headers['x-mandate-csrf'] = csrf;
  if (body instanceof FormData) options.body = body;
  else if (body !== null) { options.headers['content-type'] = 'application/json'; options.body = JSON.stringify(body); }
  const response = await fetch(path, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Request failed.');
  return value;
}
function badge(status) { return `<span class="pill ${esc(status)}">${esc(labels[status] ?? status)}</span>`; }
function setWalletLabel() {
  $('#wallet').textContent = account ? `Owner ${short(account)} ↗` : 'Connect wallet ↗';
  if (account && state && account.toLowerCase() !== state.config.ownerAddress.toLowerCase()) $('#wallet').textContent = `Wrong owner ${short(account)}`;
}
async function refresh() {
  state = await api('/api/state'); csrf = state.csrf;
  for (const id of selected) if (!state.drafts.some((row) => row.id === id && row.status === 'ready')) selected.delete(id);
  render();
}
function render() {
  const s = state.snapshot;
  $('#network-name').textContent = state.config.chainId === 11155111 ? 'Sepolia test network' : 'Local test network';
  $('#vault-balance').textContent = units(s.balance);
  $('#budget-left').textContent = units(BigInt(s.dailyLimit) > BigInt(s.spent) ? BigInt(s.dailyLimit) - BigInt(s.spent) : 0n);
  $('#reserve').textContent = units(s.reserve);
  $('#ready-count').textContent = state.drafts.filter((row) => row.status === 'ready').length;
  $('#bill-count').textContent = state.drafts.length;
  $('#list-count').textContent = state.drafts.length;
  $('#block-number').textContent = `Block ${s.blockNumber}`;
  $('#bill-summary').textContent = `${state.drafts.length} bills · ${state.drafts.filter((row) => row.status === 'approved').length} approved`;
  $('#empty-bills').hidden = state.drafts.length > 0;
  $('#bills-body').innerHTML = state.drafts.map((row) => `<tr>
    <td class="selection"><input class="bill-selection" data-id="${esc(row.id)}" type="checkbox" aria-label="Select ${esc(row.fields.invoice_number || 'invoice')}" ${row.status !== 'ready' ? 'disabled' : ''} ${selected.has(row.id) ? 'checked' : ''}></td>
    <td><strong>${esc(row.fields.invoice_number || 'Unreadable invoice number')}</strong><small>${esc(row.vendor?.label ?? row.fields.vendor_reference ?? 'Unknown vendor')}</small></td>
    <td>${esc(date(row.fields.due_date))}</td><td class="amount"><strong>${esc(row.fields.amount || '—')}</strong><small>${esc(row.fields.currency || 'No currency')}</small></td>
    <td>${badge(row.status)}</td><td><button class="review-button" data-review="${esc(row.id)}">Review ↗</button></td></tr>`).join('');
  for (const checkbox of document.querySelectorAll('.bill-selection')) checkbox.onchange = () => {
    checkbox.checked ? selected.add(checkbox.dataset.id) : selected.delete(checkbox.dataset.id); renderSelection();
  };
  for (const button of document.querySelectorAll('[data-review]')) button.onclick = () => showBill(button.dataset.review);
  renderSelection(); renderVendors(); renderControls(); renderActivity(); setWalletLabel(); renderAgent();
}
function renderAgent() {
  const agent = state.agent;
  $('#agent-workspace').hidden = !agent;
  if (!agent) return;
  const live = ['live-openai', 'live-gemini'].includes(agent.mode);
  const testAdapter = agent.mode === 'scripted-test';
  $('#model-badge').textContent = live ? 'LIVE AI CONFIGURED' : testAdapter ? 'TEST ADAPTER · NO LIVE AI' : 'AI OFF · MANUAL PREVIEW AVAILABLE';
  $('#agent-mode').textContent = live ? `Live ${agent.mode === 'live-gemini' ? 'Gemini' : 'OpenAI'} configured · ${agent.model}. Execution still needs your confirmation.` : testAdapter ? 'Scripted test adapter. No live model is used.' : 'AI is off. You can use a scripted manual preview and the restricted local test agent.';
  $('#ask-agent').disabled = agentBusy || !(live || testAdapter);
  $('#manual-preview').disabled = agentBusy;
  const plan = agent.plans.find((p) => p.id === activePlanId) ?? agent.plans[0];
  activePlanId = plan?.id ?? null;
  const result = $('#agent-result');
  if (!plan) { result.innerHTML = ''; } else {
    const p = plan.payload;
    let html = `<article class="agent-response"><span class="eyebrow">${esc(['live-openai', 'live-gemini'].includes(p.mode) ? 'LIVE AI PROPOSAL' : p.mode === 'scripted-manual' ? 'SCRIPTED MANUAL PREVIEW · NO AI' : 'TEST ADAPTER · NO LIVE AI')}</span><p>${esc(p.message)}</p>`;
    if (p.plan && !['clarify', 'unsupported'].includes(p.intent)) {
      html += `<p class="form-note">Plan snapshot at block ${esc(p.plan.blockNumber)} · ${esc(plan.status)}. Entries below describe that preview; confirmed outcomes are listed separately.</p>`;
      html += `<p class="plan-totals">Eligible total <strong>${esc(units(p.plan.total))} MDT</strong> · Projected balance ${esc(units(p.plan.projectedBalance))} · Projected daily budget left ${esc(units(p.plan.projectedDailyLeft))} MDT</p>`;
      html += p.plan.entries.map((e) => `<div class="plan-entry"><div><strong>${esc(e.invoice)}</strong><span>${esc(e.amount ? units(e.amount) : '—')} MDT · ${esc(e.code)}</span></div><p>${esc(e.reason)} ${esc(e.nextAction)}</p>${e.recipient ? `<small class="mono">${esc(e.recipient)}</small>` : ''}</div>`).join('');
      if (p.intent === 'pay' && plan.status === 'prepared' && p.plan.entries.some((e) => e.code === 'ready')) html += '<label class="check-label"><input id="confirm-agent" type="checkbox">I checked the exact eligible bills and want the agent to pay them with test tokens.</label><button id="run-agent" class="button button-primary" disabled>Run approved batch ↗</button>';
      else if (p.intent !== 'pay') html += '<p class="form-note">This is read-only. To pay, make an explicit payment request or open the manual preview.</p>';
      else if (plan.status !== 'prepared') html += `<p class="form-note">Batch ${esc(plan.status)}. Confirmed receipts appear below. Ask for a fresh plan to continue.</p>`;
    }
    if (p.kind === 'correction') html += `<p>Draft field: <strong>${esc(p.correction.field)}</strong> → ${esc(p.correction.value)}</p>`;
    if (p.kind === 'extraction') html += `<pre>${esc(JSON.stringify(p.fields, null, 2))}</pre>`;
    if (['correction', 'extraction'].includes(p.kind) && plan.status === 'prepared') html += '<button id="apply-agent-proposal" class="button button-outline">Apply to draft, then review ↗</button>';
    result.innerHTML = html + '</article>';
    if ($('#confirm-agent')) $('#confirm-agent').onchange = () => { $('#run-agent').disabled = !$('#confirm-agent').checked || agentBusy; };
    if ($('#run-agent')) $('#run-agent').onclick = () => agentAction(async () => {
      const result = await api(`/api/agent/plans/${plan.id}/execute`, 'POST', { confirmed: true }); notify(result.message);
    });
    if ($('#apply-agent-proposal')) $('#apply-agent-proposal').onclick = () => agentAction(async () => {
      const updated = await api(`/api/agent/plans/${plan.id}/apply`, 'POST', {}); await refresh(); showBill(updated.id);
      notify('Draft changed. Check it against the source; existing signed permission was not changed.');
    });
  }
  $('#payment-results').innerHTML = agent.payments.map((p) => `<article class="plan-entry"><div><strong>${esc(p.payload.invoice)} · ${esc(units(p.payload.amount))} MDT</strong>${badge(p.status)}</div><p class="mono">${esc(p.hash)}</p><p>${esc(p.error ?? (p.status === 'confirmed' ? `Verified payment event in block ${p.receipt.blockNumber}.` : 'No confirmed payment is claimed.'))}</p>${['submitting', 'submitted', 'outcome_unknown'].includes(p.status) ? `<button class="button button-outline" data-payment-reconcile="${esc(p.id)}">Recheck original payment hash ↻</button>` : ''}</article>`).join('');
  for (const b of document.querySelectorAll('[data-payment-reconcile]')) b.onclick = () => agentAction(async () => { await api(`/api/agent/payments/${b.dataset.paymentReconcile}/reconcile`, 'POST', {}); });
}
async function agentAction(work) {
  if (agentBusy) return;
  agentBusy = true; renderAgent();
  try { await work(); } catch (error) { report(error); }
  finally { agentBusy = false; await refresh().catch(report); }
}
function renderSelection() {
  $('#selected-count').textContent = selected.size;
  $('#approve-selected').disabled = selected.size === 0 || signing;
  const ready = state.drafts.filter((row) => row.status === 'ready');
  $('#select-all').disabled = !ready.length;
  $('#select-all').checked = ready.length > 0 && ready.every((row) => selected.has(row.id));
}
function renderVendors() {
  $('#vendors-list').innerHTML = state.snapshot.vendors.map((vendor) => `<form class="vendor-card" data-vendor="${esc(vendor.reference)}">
    <p class="eyebrow">${esc(vendor.reference)}</p><h3>${esc(vendor.label)}</h3><p>Registry revision ${esc(vendor.revision)} · ${vendor.enabled ? 'Enabled' : 'Disabled'}</p>
    <label>Approved recipient<input name="recipient" value="${esc(vendor.recipient)}" autocomplete="off" required></label>
    <label class="check-label"><input type="checkbox" name="enabled" ${vendor.enabled ? 'checked' : ''}> Enable this recipient for new approvals</label>
    <p class="form-note">A registry change requires your signature. Existing unpaid bills for this vendor will need a fresh approval.</p>
    <button class="button button-outline">Review vendor change ↗</button></form>`).join('');
  for (const form of document.querySelectorAll('[data-vendor]')) form.onsubmit = (event) => {
    event.preventDefault(); prepare('vendor', { reference: form.dataset.vendor, recipient: form.elements.recipient.value.trim(), enabled: form.elements.enabled.checked }).catch(report);
  };
}
function renderControls() {
  const s = state.snapshot;
  for (const key of ['maxPerBill', 'dailyLimit', 'reserve']) $('#limits-form').elements[key].value = units(s[key]);
  $('#agent-form').elements.agent.value = s.agent;
  $('#agent-form').elements.notBefore.value = localTime(new Date(Number(s.now) * 1000).toISOString());
  $('#agent-form').elements.expiresAt.value = localTime(new Date((Number(s.now) + 86400) * 1000).toISOString());
  $('#pause-status').textContent = s.paused ? 'Payments paused' : 'Payments enabled';
  $('#pause').textContent = s.paused ? 'Review resume' : 'Review pause';
}
function renderActivity() {
  $('#activity-list').innerHTML = state.intents.length ? state.intents.map((row) => `<article class="activity-item">
    <div><strong>${esc(row.payload.title)}</strong>${badge(row.status)}</div>
    <p>${esc(row.payload.createdAt)} · ${state.config.chainId === 11155111 ? 'SEPOLIA TESTNET' : 'LOCAL CHAIN'} ${state.config.chainId}</p>
    ${row.hash ? `<p class="mono">${esc(row.hash)}</p>` : '<p>No transaction hash recorded. No confirmation is claimed.</p>'}
    ${row.error ? `<p>${esc(row.error)}</p>` : ''}
    ${row.hash && !['confirmed', 'invalid', 'reverted'].includes(row.status) ? `<button class="button button-outline" data-reconcile="${esc(row.id)}">Recheck original hash ↻</button>` : ''}
    ${!row.hash && row.status === 'prepared' ? `<button class="button button-quiet" data-record="${esc(row.id)}">Record a hash from your wallet</button>` : ''}</article>`).join('')
    : '<div class="empty"><span>◷</span><h3>Every approval leaves a record.</h3><p>Confirmed, pending and rejected actions will appear here.</p></div>';
  for (const button of document.querySelectorAll('[data-reconcile]')) button.onclick = async () => {
    try { const result = await api(`/api/intents/${button.dataset.reconcile}/reconcile`, 'POST', {}); notify(`Transaction: ${labels[result.status] ?? result.status}.`); await refresh(); } catch (error) { report(error); }
  };
  for (const button of document.querySelectorAll('[data-record]')) button.onclick = async () => {
    const hash = prompt('Paste the transaction hash from your wallet. It will be verified against this exact reviewed action.');
    if (!hash) return;
    try { await api(`/api/intents/${button.dataset.record}/submitted`, 'POST', { hash: hash.trim() }); await refresh(); } catch (error) { report(error); }
  };
}
async function upload(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) throw new Error('Files must be 5 MB or smaller.');
  const form = new FormData(); form.append('file', file);
  $('#upload').disabled = true; $('#load-sample').disabled = true;
  notify('Reading the bill. Your wallet will not be used.');
  try { await api('/api/upload', 'POST', form); await refresh(); notify('Imported as drafts. Open each bill to check its details against the source.'); }
  finally { $('#upload').disabled = false; $('#upload').value = ''; $('#load-sample').disabled = false; }
}
function billFields(form) {
  const fields = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(fields)) if (!['vendor_reference', 'invoice_number', 'amount', 'currency', 'invoice_date', 'due_date', 'recipient', 'owner_priority', 'not_before', 'expires_at', 'note'].includes(key)) delete fields[key];
  fields.not_before = isoTime(fields.not_before); fields.expires_at = isoTime(fields.expires_at);
  return fields;
}
function showBill(id) {
  const generation = ++reviewGeneration;
  currentDraft = state.drafts.find((row) => row.id === id);
  if (!currentDraft) return;
  const row = currentDraft, f = row.fields;
  $('#review-title').textContent = f.invoice_number || 'Review invoice';
  $('#source-name').textContent = row.filename;
  $('#source-text').textContent = row.source;
  const activeApproval = row.chainBill && row.chainBill.amount !== '0' && !row.chainBill.paid && !row.chainBill.cancelled;
  $('#review-issues').innerHTML = [...row.errors.map((text) => `<p class="issue error">${esc(text)}</p>`), ...row.warnings.map((text) => `<p class="issue">${esc(text)}</p>`),
    ...(activeApproval ? ['<p class="issue">An on-chain approval exists. Editing this draft does not revoke it. Cancel or replace that approval to stop its existing permission.</p>'] : [])].join('');
  const field = (name, label, type = 'text', full = false) => `<label class="${full ? 'full-width' : ''}">${label}<input class="bill-field" name="${name}" type="${type}" ${type === 'datetime-local' ? 'step="1"' : ''} value="${esc(type === 'datetime-local' ? localTime(f[name]) : f[name])}" ${row.locked ? 'disabled' : ''}></label>`;
  $('#bill-form').innerHTML = `<div class="field-grid"><label>Verified vendor<select class="bill-field" name="vendor_reference" ${row.locked ? 'disabled' : ''}><option value="">Choose vendor</option>${state.snapshot.vendors.map((v) => `<option value="${esc(v.reference)}" ${v.reference === f.vendor_reference ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
    ${field('invoice_number', 'Invoice number')}${field('amount', 'Exact amount')}${field('currency', 'Token / currency')}
    ${field('invoice_date', 'Invoice date', 'date')}${field('due_date', 'Due date', 'date')}
    ${field('owner_priority', 'Owner priority (1 first)', 'number')}${field('recipient', 'Address stated in invoice')}
    ${field('not_before', 'Payment starts · local time', 'datetime-local')}${field('expires_at', 'Approval expires · local time', 'datetime-local')}
    <label class="full-width">Invoice note<textarea name="note" class="bill-field" ${row.locked ? 'disabled' : ''}>${esc(f.note)}</textarea></label></div>
    <button type="button" id="use-window" class="button button-quiet" ${row.locked ? 'disabled' : ''}>Use a 24-hour payment window</button>
    <div class="trusted-recipient"><strong>Recipient from owner-controlled registry</strong><span class="mono">${esc(row.vendor?.recipient ?? 'Select an approved vendor')}</span><br>Invoice text cannot replace this address.</div>
    ${row.recipientMismatch ? '<label class="check-label"><input id="recipient-checked" type="checkbox">I independently verified the registry recipient and approve using it despite the invoice mismatch.</label>' : ''}
    ${row.similar ? '<label class="check-label"><input id="similarity-checked" type="checkbox">I checked the similar invoice number and confirmed this is a different bill.</label>' : ''}
    <label class="check-label"><input id="source-checked" type="checkbox" ${row.locked ? 'disabled' : ''}>I checked these fields, recipient and payment window against the source.</label>
    <div class="review-actions"><button type="button" id="save-draft" class="button button-outline" ${row.locked ? 'disabled' : ''}>Save changes</button><button type="button" id="mark-reviewed" class="button button-primary" disabled>Mark reviewed ✓</button></div>
    ${activeApproval ? '<button type="button" id="cancel-bill" class="button button-danger">Review cancellation</button>' : ''}
    <p class="form-note">Saving a change clears the earlier review. New or changed details need a fresh owner signature before they can be used.</p>
    ${state.agent ? `<button type="button" id="ai-extract" class="button button-outline" ${!['live-openai', 'live-gemini'].includes(state.agent.mode) || row.locked ? 'disabled' : ''}>Send synthetic source to AI for field suggestions ↗</button>` : ''}`;
  if ($('#ai-extract')) $('#ai-extract').onclick = () => agentAction(async () => {
    const p = await api(`/api/agent/extract/${id}`, 'POST', {}); activePlanId = p.id;
    $('#bill-dialog').close(); notify('AI suggestions are below the bill table. Review them before applying to the draft.');
  });
  const resetReview = () => { $('#source-checked').checked = false; $('#mark-reviewed').disabled = true; };
  for (const input of $('#bill-form').querySelectorAll('.bill-field')) input.addEventListener('input', resetReview);
  $('#source-checked').onchange = () => { $('#mark-reviewed').disabled = !$('#source-checked').checked; };
  $('#use-window').onclick = () => {
    const form = $('#bill-form'), start = Number(state.snapshot.now);
    form.elements.not_before.value = localTime(new Date(start * 1000).toISOString());
    form.elements.expires_at.value = localTime(new Date((start + 86400) * 1000).toISOString()); resetReview();
  };
  $('#save-draft').onclick = async () => {
    $('#save-draft').disabled = true;
    try {
      await api(`/api/drafts/${id}`, 'PATCH', { version: row.version, fields: billFields($('#bill-form')) });
      await refresh();
      if ($('#bill-dialog').open && currentDraft?.id === id && reviewGeneration === generation) showBill(id);
      notify('Changes saved. Check the source and review this version again.');
    }
    catch (error) { report(error); }
    finally { if ($('#bill-dialog').open && currentDraft?.id === id && reviewGeneration === generation) $('#save-draft').disabled = row.locked; }
  };
  $('#mark-reviewed').onclick = async () => {
    try {
      const fields = billFields($('#bill-form'));
      let version = row.version;
      if (Object.keys(f).some((key) => fields[key] !== f[key])) version = (await api(`/api/drafts/${id}`, 'PATCH', { version, fields })).version;
      await api(`/api/drafts/${id}/review`, 'POST', { version, checked: $('#source-checked').checked,
        recipientChecked: $('#recipient-checked')?.checked ?? false, similarityChecked: $('#similarity-checked')?.checked ?? false });
      $('#bill-dialog').close(); await refresh(); notify('Bill reviewed. Select it in the list when you are ready to approve.');
    } catch (error) {
      await refresh();
      if ($('#bill-dialog').open && currentDraft?.id === id && reviewGeneration === generation) showBill(id);
      report(error);
    }
  };
  $('#bill-form').onsubmit = (event) => event.preventDefault();
  if ($('#cancel-bill')) $('#cancel-bill').onclick = () => { $('#bill-dialog').close(); prepare('cancel', { key: row.key }).catch(report); };
  $('#delete-source').disabled = row.locked;
  $('#delete-source').onclick = async () => {
    if (!confirm('Remove this source text and all its local drafts? On-chain records and opaque transaction references remain.')) return;
    try { await api(`/api/documents/${row.document_id}`, 'DELETE', {}); $('#bill-dialog').close(); await refresh(); notify('Source text and local drafts removed. On-chain records and transaction references remain.'); } catch (error) { report(error); }
  };
  if (!$('#bill-dialog').open) $('#bill-dialog').showModal();
}
async function connectWallet() {
  wallet = window.ethereum?.providers?.find((p) => p.isMetaMask) ?? window.ethereum;
  if (!wallet) throw new Error('No browser wallet found. You can still upload and review bills. Use a test wallet to sign approvals.');
  provider = new BrowserProvider(wallet, undefined, { cacheTimeout: -1 });
  const accounts = await wallet.request({ method: 'eth_requestAccounts' });
  account = accounts[0] ?? null; setWalletLabel();
  const changed = () => { account = null; setWalletLabel(); notify('Wallet account or network changed. Connect again before signing.', true); };
  wallet.removeListener?.('accountsChanged', changed); wallet.on?.('accountsChanged', changed); wallet.on?.('chainChanged', changed);
  await checkWallet();
  notify('Owner wallet connected on the expected test network. No transaction has been requested.');
}
async function checkWallet() {
  if (!wallet || !account) throw new Error('Connect the owner wallet before signing.');
  const accounts = await wallet.request({ method: 'eth_accounts' });
  const chain = Number(BigInt(await wallet.request({ method: 'eth_chainId' })));
  if (chain !== state.config.chainId) throw new Error(`Wrong network. Select local test chain ${state.config.chainId} in your wallet.`);
  if (accounts[0]?.toLowerCase() !== state.config.ownerAddress.toLowerCase()) throw new Error(`Wrong owner account. This vault belongs to ${state.config.ownerAddress}. For local testing, restart npm run dev -- --owner YOUR_PUBLIC_ADDRESS. Never enter a private key here.`);
  account = accounts[0];
}
async function prepare(action, values) {
  if (signing) throw new Error('Finish or reconcile the current wallet request first.');
  intent = await api('/api/prepare', 'POST', { action, ...values });
  const p = intent.payload;
  if (iface.encodeFunctionData(p.method, p.args).toLowerCase() !== p.data.toLowerCase()
    || p.to.toLowerCase() !== state.config.vaultAddress.toLowerCase() || p.chainId !== state.config.chainId) throw new Error('Transaction details do not match the expected vault.');
  const decoded = iface.parseTransaction({ data: p.data });
  $('#transaction-title').textContent = p.title;
  let details = `<p class="form-note">This owner action changes permission. It does not pay a bill.</p><dl><dt>Network</dt><dd>${p.chainId === 11155111 ? 'Sepolia testnet' : 'Local test chain'} ${p.chainId}</dd><dt>Vault</dt><dd class="mono">${esc(p.to)}</dd><dt>Owner</dt><dd class="mono">${esc(p.owner)}</dd></dl>`;
  if (p.method === 'approveBills') {
    details += decoded.args[0].map((bill, i) => {
      const row = state.drafts.find((row) => row.id === p.drafts[i].id);
      return `<div class="tx-bill"><strong>${esc(row?.fields.invoice_number ?? p.expectedEvents[i].values.billKey)} · ${esc(units(bill.amount))} MDT</strong><br>${esc(row?.vendor?.label ?? '')}<br><span class="mono">${esc(bill.recipient)}</span><br>From ${esc(new Date(Number(bill.notBefore) * 1000).toISOString())}<br>Until ${esc(new Date(Number(bill.expiresAt) * 1000).toISOString())}<details><summary>Document fingerprint and bill key</summary><span class="mono">Source: ${esc(bill.documentHash)}<br>Bill: ${esc(p.expectedEvents[i].values.billKey)}</span></details></div>`;
    }).join('');
  } else if (p.method === 'setLimits') details += `<div class="tx-bill">Per bill: <strong>${esc(units(decoded.args[0]))} MDT</strong><br>Per UTC day: ${esc(units(decoded.args[1]))} MDT<br>Minimum reserve: ${esc(units(decoded.args[2]))} MDT</div>`;
  else details += `<div class="tx-bill">${p.expectedEvents.map((event) => Object.entries(event.values).map(([key, value]) => `<div>${esc(key)}: <span class="mono">${esc(value)}</span></div>`).join('')).join('')}</div>`;
  details += '<label class="check-label"><input id="tx-reviewed" type="checkbox">I checked this exact action and its details.</label>';
  $('#transaction-details').innerHTML = details;
  $('#transaction-status').textContent = account ? 'Your wallet will show the transaction before you sign. Gas is separate test ETH.' : 'Connect the owner wallet first. Uploading and reviewing bills does not need a wallet.';
  $('#send-transaction').disabled = true;
  $('#cancel-transaction').textContent = 'Cancel';
  $('#tx-reviewed').onchange = () => { $('#send-transaction').disabled = !$('#tx-reviewed').checked || !account || signing; };
  $('#transaction-dialog').showModal();
}
async function closeTransaction() {
  if (signing) return;
  if (intent && !intent.hash && intent.status === 'prepared') await api(`/api/intents/${intent.id}/cancel`, 'POST', {});
  $('#transaction-dialog').close(); intent = null; await refresh();
}
async function sendTransaction() {
  if (!intent || signing || !$('#tx-reviewed').checked) return;
  let hash = null;
  signing = true; $('#send-transaction').disabled = true; $('#cancel-transaction').disabled = true;
  try {
    await checkWallet();
    const checked = await api(`/api/intents/${intent.id}/validate`, 'POST', {});
    if (checked.payload.data !== intent.payload.data) throw new Error('The reviewed transaction changed. Start a fresh review.');
    $('#transaction-status').textContent = 'Waiting for your wallet. No approval is confirmed yet.';
    const signer = await provider.getSigner(account);
    const tx = await signer.sendTransaction({ to: intent.payload.to, data: intent.payload.data, value: 0n });
    hash = tx.hash;
    intent = { ...intent, hash };
    localStorage.setItem('mandate.pending', JSON.stringify({ id: intent.id, hash, instanceId: state.config.instanceId }));
    $('#transaction-status').textContent = 'Submitted. Waiting for a matching receipt. Do not send another transaction.';
    intent = await api(`/api/intents/${intent.id}/submitted`, 'POST', { hash });
    for (let i = 0; i < 8 && intent.status === 'submitted'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      intent = await api(`/api/intents/${intent.id}/reconcile`, 'POST', {});
    }
    localStorage.removeItem('mandate.pending');
    if (intent.status === 'confirmed') notify('Owner action confirmed. The receipt matches the exact reviewed details.');
    else notify(`Transaction ${labels[intent.status] ?? intent.status}. Recheck its original hash in Activity; do not submit again.`, intent.status !== 'submitted');
    $('#transaction-dialog').close(); await refresh();
  } catch (error) {
    const rejected = error.code === 'ACTION_REJECTED' || error.code === 4001 || error.info?.error?.code === 4001;
    if (!hash && rejected) {
      intent = await api(`/api/intents/${intent.id}/cancel`, 'POST', {}).catch(() => intent);
      $('#transaction-status').textContent = 'Signature rejected. No transaction was submitted by this request.';
      notify('You rejected the wallet request. No approval was confirmed.');
    } else {
      $('#transaction-status').textContent = hash ? 'Outcome unknown. The original hash is saved; check Activity before any retry.' : `${error.shortMessage ?? error.message} Check your wallet before trying again.`;
      report(new Error($('#transaction-status').textContent));
    }
    await refresh().catch(() => {});
  } finally {
    signing = false; $('#cancel-transaction').disabled = false; $('#cancel-transaction').textContent = 'Close';
    // A retry always needs a fresh review or reconciliation, never a second click on Send.
    $('#send-transaction').disabled = true;
  }
}

for (const button of document.querySelectorAll('[data-tab]')) button.onclick = () => {
  const tab = button.dataset.tab;
  for (const row of document.querySelectorAll('[data-tab]')) row.classList.toggle('active', row === button);
  for (const panel of document.querySelectorAll('.tab-panel')) panel.hidden = panel.id !== `${tab}-panel`;
  const titles = { bills: ['Bills', 'Good decisions start here.', 'Review your bills. Approve the details. Stay in control.'],
    vendors: ['Vendors', 'Know where your money goes.', 'A trusted recipient starts with your approval.'],
    controls: ['Rules & access', 'Your wallet. Your boundaries.', 'Set clear limits and keep control of agent access.'],
    activity: ['Activity', 'Every action, accounted for.', 'Check the receipt. Know what is actually confirmed.'] };
  [$('#page-name').textContent, $('#page-title').textContent, $('#page-description').textContent] = titles[tab];
};
$('#refresh').onclick = () => refresh().catch(report);
$('#agent-form-request').onsubmit = (e) => {
  e.preventDefault(); const message = $('#agent-message').value;
  agentAction(async () => { const p = await api('/api/agent/request', 'POST', { message, previousPlanId: activePlanId }); activePlanId = p.id; });
};
$('#manual-preview').onclick = () => agentAction(async () => {
  const p = await api('/api/agent/preview', 'POST', {}); activePlanId = p.id;
});
$('#wallet').onclick = () => connectWallet().catch(report);
$('#upload').onchange = () => upload($('#upload').files[0]).catch(report);
$('#load-sample').onclick = async () => {
  try { const response = await fetch('/api/sample.csv'); if (!response.ok) throw new Error('Sample bills could not be loaded.'); await upload(new File([await response.blob()], 'mandate-demo-bills.csv', { type: 'text/csv' })); } catch (error) { report(error); }
};
for (const event of ['dragenter', 'dragover']) $('#drop-zone').addEventListener(event, (e) => { e.preventDefault(); $('#drop-zone').classList.add('drag-over'); });
$('#drop-zone').ondragleave = () => $('#drop-zone').classList.remove('drag-over');
$('#drop-zone').ondrop = (e) => { e.preventDefault(); $('#drop-zone').classList.remove('drag-over'); if (e.dataTransfer.files.length !== 1) return notify('Choose one file per upload.', true); upload(e.dataTransfer.files[0]).catch(report); };
$('#select-all').onchange = () => { for (const row of state.drafts.filter((row) => row.status === 'ready')) $('#select-all').checked ? selected.add(row.id) : selected.delete(row.id); render(); };
$('#approve-selected').onclick = () => prepare('bills', { ids: [...selected] }).catch(report);
$('#limits-form').onsubmit = (e) => { e.preventDefault(); prepare('limits', Object.fromEntries(new FormData(e.currentTarget))).catch(report); };
$('#agent-form').onsubmit = (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); prepare('agent', { ...data, notBefore: isoTime(data.notBefore), expiresAt: isoTime(data.expiresAt) }).catch(report); };
$('#pause').onclick = () => prepare('pause', { paused: !state.snapshot.paused }).catch(report);
$('#revoke').onclick = () => prepare('revoke', {}).catch(report);
$('.close-dialog').onclick = () => $('#bill-dialog').close();
$('#close-transaction').onclick = () => closeTransaction().catch(report);
$('#cancel-transaction').onclick = () => closeTransaction().catch(report);
$('#transaction-dialog').addEventListener('cancel', (e) => { e.preventDefault(); closeTransaction().catch(report); });
$('#send-transaction').onclick = () => sendTransaction();

try {
  await refresh();
  const pending = JSON.parse(localStorage.getItem('mandate.pending') ?? 'null');
  if (pending?.instanceId === state.config.instanceId) {
    await api(`/api/intents/${pending.id}/submitted`, 'POST', { hash: pending.hash });
    localStorage.removeItem('mandate.pending'); await refresh(); notify('Recovered the saved transaction hash. Check Activity for its verified outcome.');
  }
} catch (error) { report(error); }
