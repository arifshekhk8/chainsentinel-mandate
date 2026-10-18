import assert from 'node:assert/strict';
import { test } from 'node:test';
import { id } from 'ethers';
import { billKeyFor, invoiceIdHash, normalizeInvoiceNumber } from '../scripts/bill-identity.mjs';

const vault = '0x0000000000000000000000000000000000000001';
const vendor = id('V-HOST');

test('renaming/reformatting the same invoice cannot create a different payment identity', () => {
  assert.equal(normalizeInvoiceNumber('\t host-1001 \r\n'), 'HOST-1001');
  assert.equal(invoiceIdHash(' host-1001 '), invoiceIdHash('HOST-1001'));
  assert.equal(billKeyFor(31337, vault, vendor, 'host-1001'), billKeyFor(31337, vault, vendor, ' HOST-1001 '));
});

test('preserve internal spaces/punctuation rather than silently merging different IDs', () => {
  assert.equal(normalizeInvoiceNumber('ab  1-02/3'), 'AB  1-02/3');
  assert.notEqual(invoiceIdHash('HOST-1001'), invoiceIdHash('HOST1001'));
  assert.notEqual(invoiceIdHash('AB 1'), invoiceIdHash('AB  1'));
});

test('non-ASCII, confusables, empty and control-filled invoice numbers require review', () => {
  for (const value of ['', ' \t ', null, 1001, 'HОST-1001', 'ＨOST-1001', 'HOST\u00a01001', 'AB\n12', 'A\0B']) {
    assert.throws(() => normalizeInvoiceNumber(value), /needs owner review/);
  }
});

test('same invoice number stays separate across vendors, vaults and chains', () => {
  const key = billKeyFor(31337, vault, vendor, 'COMMON-100');
  assert.notEqual(key, billKeyFor(31337, vault, id('V-DESIGN'), 'COMMON-100'));
  assert.notEqual(key, billKeyFor(11155111, vault, vendor, 'COMMON-100'));
  assert.notEqual(key, billKeyFor(31337, '0x0000000000000000000000000000000000000002', vendor, 'COMMON-100'));
});
