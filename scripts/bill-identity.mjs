import { AbiCoder, getAddress, id, keccak256 } from 'ethers';

// Owner-reviewed vendor ID and invoice text are trusted only after the review workflow.
// Keep internal punctuation/spaces: silently merging invoice IDs can hide distinct bills.
export function normalizeInvoiceNumber(value) {
  if (typeof value !== 'string') throw new Error('Invoice number needs owner review');
  const trimmed = value.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
  if (!trimmed || !/^[\x20-\x7e]+$/.test(trimmed)) throw new Error('Invoice number needs owner review');
  return trimmed.toUpperCase();
}

export function invoiceIdHash(value) {
  return id(normalizeInvoiceNumber(value));
}

export function billKeyFor(chainId, vaultAddress, vendorId, invoiceNumber) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'bytes32', 'bytes32'],
    [BigInt(chainId), getAddress(vaultAddress), vendorId, invoiceIdHash(invoiceNumber)],
  ));
}
