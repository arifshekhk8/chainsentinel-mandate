import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Call the pinned native binary directly. The 1.7.1 npm wrapper does not propagate its
// child's non-zero exit status, which would incorrectly let a failing test command pass.
export function foundryBinary(tool) {
  if (!['forge', 'anvil'].includes(tool)) throw new Error('Unsupported local tool');
  const arch = process.arch === 'x64' ? 'amd64' : process.arch;
  const name = process.platform === 'win32' ? `${tool}.exe` : tool;
  try {
    return require.resolve(`@foundry-rs/${tool}-${process.platform}-${arch}/bin/${name}`);
  } catch {
    const packageDirectory = dirname(require.resolve(`@foundry-rs/${tool}/package.json`));
    const fallback = resolve(packageDirectory, '../dist', name);
    if (!existsSync(fallback)) throw new Error(`Missing ${tool} binary; run npm ci with install scripts enabled`);
    return fallback;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const child = spawn(foundryBinary(process.argv[2]), process.argv.slice(3), { stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
    child.on('error', () => { console.error('Could not start the local Foundry tool'); process.exitCode = 1; });
    child.on('exit', (code) => { process.exitCode = code ?? 1; });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
