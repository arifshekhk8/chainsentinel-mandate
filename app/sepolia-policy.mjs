import { formatEther, parseEther, parseUnits, toQuantity } from 'ethers';
import { check } from './errors.mjs';

export const SEPOLIA = 11155111;
export const DEMO_BUDGET = parseEther('0.001');
export const AGENT_FUNDING = parseEther('0.00005');
export const FEE_CAP = parseUnits('0.05', 'gwei');
export const REQUIRED_CONFIRMATIONS = 2;

// Count maximum reviewed owner outflow, including the entire agent funding.
// Actual agent gas is already covered by that funding, not charged a second time.
export function reservedBudget(store, owner, chainId = SEPOLIA) {
  return store.intents().filter((r) => r.payload.chainId === chainId
    && r.payload.owner?.toLowerCase() === owner.toLowerCase() && r.status !== 'cancelled')
    .reduce((sum, r) => {
      check(r.payload.fees, 'An earlier public action has no budget record. Inspect it before continuing.', 409);
      return sum + BigInt(r.payload.fees.maximumOutflowWei);
    }, 0n);
}

export async function feeReview(provider, request) {
  const [estimate, fees, balance] = await Promise.all([
    provider.estimateGas(request), provider.getFeeData(), provider.getBalance(request.from),
  ]);
  check(fees.maxFeePerGas !== null && fees.maxPriorityFeePerGas !== null,
    'The RPC did not provide EIP-1559 fees. No transaction was prepared.', 503);
  check(fees.maxFeePerGas <= FEE_CAP && fees.maxPriorityFeePerGas <= FEE_CAP,
    'Sepolia fees exceed the 0.05 gwei cap. Wait; the budget will not be increased.', 409);
  const gasLimit = (estimate * 120n + 99n) / 100n;
  // Stay below EIP-7825's 2^24 limit. Public deployment estimates exceed local Cancun estimates.
  check(gasLimit <= 16000000n, 'The gas estimate exceeds this demo’s transaction limit.', 409);
  const maximumOutflow = gasLimit * fees.maxFeePerGas + BigInt(request.value ?? 0);
  check(balance >= maximumOutflow, 'The owner needs more Sepolia test ETH for this reviewed action.', 409);
  return { gasLimit: gasLimit.toString(), maxFeePerGas: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(), maximumOutflowWei: maximumOutflow.toString(),
    maximumOutflowETH: formatEther(maximumOutflow), feeCapGwei: '0.05', totalDemoBudgetETH: '0.001' };
}

export function addBudgetedIntent(store, payload) {
  store.db.exec('BEGIN IMMEDIATE');
  try {
    if (payload.setupAction) check(!store.intents().some((r) => r.payload.instanceId === payload.instanceId
      && (!['confirmed', 'cancelled', 'reverted'].includes(r.status)
        || r.status === 'confirmed' && r.payload.setupAction === payload.setupAction)),
    'A setup action is already active or this step is already confirmed. Reconcile the original.', 409);
    check(reservedBudget(store, payload.owner, payload.chainId) + BigInt(payload.fees.maximumOutflowWei) <= DEMO_BUDGET,
      'This action would exceed the total 0.001 Sepolia ETH demo budget. Nothing was sent.', 409);
    const result = store.addIntent(payload);
    store.db.exec('COMMIT'); return result;
  } catch (error) { store.db.exec('ROLLBACK'); throw error; }
}

export function walletFees(fees) {
  return { gas: toQuantity(fees.gasLimit), maxFeePerGas: toQuantity(fees.maxFeePerGas),
    maxPriorityFeePerGas: toQuantity(fees.maxPriorityFeePerGas) };
}
export function matchesFeeReview(tx, fees) {
  return tx.gasLimit <= BigInt(fees.gasLimit)
    && (tx.maxFeePerGas ?? tx.gasPrice) <= BigInt(fees.maxFeePerGas)
    && (tx.maxPriorityFeePerGas ?? 0n) <= BigInt(fees.maxPriorityFeePerGas);
}
