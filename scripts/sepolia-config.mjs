import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { FetchRequest, JsonRpcProvider, Wallet, ZeroAddress, getAddress } from 'ethers';
import { check } from '../app/errors.mjs';
import { SEPOLIA } from '../app/sepolia-policy.mjs';

export const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
export const DATA_DIRECTORY = resolve('local-data/sepolia');
export function privateJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  check(!existsSync(path), 'A private setup file already exists. Preserve it; do not overwrite keys.');
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
function readPrivate(path) {
  const stat = lstatSync(path);
  check(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0,
    'Private Sepolia files must be regular files readable only by their owner.');
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function initializeSetup(ownerAddress, directory = DATA_DIRECTORY) {
  const owner = getAddress(ownerAddress);
  check(owner !== ZeroAddress, 'Use the owner’s non-zero public address.');
  const seedPath = resolve(directory, 'setup.json'), keyPath = resolve(directory, 'agent-key.json');
  if (existsSync(seedPath)) {
    const seed = readPrivate(seedPath);
    check(seed.ownerAddress === owner, 'The saved Sepolia setup belongs to a different owner. Preserve it.');
    return loadSetup(directory);
  }
  // Dedicated test-agent key only. Owner secrets are never accepted or read.
  let agent;
  if (existsSync(keyPath)) agent = new Wallet(readPrivate(keyPath).privateKey);
  else {
    agent = Wallet.createRandom();
    privateJson(keyPath, { privateKey: agent.privateKey });
  }
  const seed = { version: 'mandate-sepolia-setup-v1', instanceId: randomUUID(), chainId: SEPOLIA,
    ownerAddress: owner, agentAddress: agent.address,
    vendors: { 'V-HOST': Wallet.createRandom().address, 'V-DESIGN': Wallet.createRandom().address },
    createdAt: new Date().toISOString() };
  privateJson(seedPath, seed); return loadSetup(directory);
}
export function loadSetup(directory = DATA_DIRECTORY) {
  const seed = readPrivate(resolve(directory, 'setup.json'));
  const agent = new Wallet(readPrivate(resolve(directory, 'agent-key.json')).privateKey);
  check(seed.chainId === SEPOLIA && getAddress(seed.ownerAddress) === seed.ownerAddress
    && agent.address === seed.agentAddress && agent.address !== seed.ownerAddress,
  'The private Sepolia setup does not match its dedicated agent.');
  const addresses = [seed.ownerAddress, seed.agentAddress, seed.vendors['V-HOST'], seed.vendors['V-DESIGN']].map(getAddress);
  check(!addresses.includes(ZeroAddress) && new Set(addresses).size === 4, 'Use four distinct non-zero demo accounts.');
  return { seed, agent };
}
export function publicProvider(url = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC) {
  const parsed = new URL(url);
  check(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'Use an HTTPS Sepolia RPC URL without embedded login credentials.');
  const request = new FetchRequest(url); request.timeout = 20000;
  request.setThrottleParams({ maxAttempts: 1 });
  request.redirectFunc = async () => { throw new Error('RPC redirects are disabled.'); };
  const provider = new JsonRpcProvider(request, undefined, { cacheTimeout: -1, batchMaxCount: 1 });
  provider.pollingInterval = 4000; return provider;
}
export function readArtifacts() {
  const artifact = (name) => JSON.parse(readFileSync(`out/${name}.sol/${name}.json`, 'utf8'));
  return { token: artifact('MandateDemoToken'), vault: artifact('MandateVault') };
}
