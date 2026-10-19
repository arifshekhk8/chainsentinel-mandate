import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await build({ entryPoints: [new URL('../app/client.mjs', import.meta.url).pathname],
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  outfile: new URL('../dist/app.js', import.meta.url).pathname, legalComments: 'eof' });
for (const file of ['index.html', 'app.css']) await copyFile(new URL(`../app/public/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
await mkdir(new URL('../dist/setup/', import.meta.url), { recursive: true });
await build({ entryPoints: [new URL('../app/setup-client.mjs', import.meta.url).pathname], bundle: true,
  platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  outfile: new URL('../dist/setup/app.js', import.meta.url).pathname, legalComments: 'eof' });
await copyFile(new URL('../app/public/setup.html', import.meta.url), new URL('../dist/setup/index.html', import.meta.url));
await copyFile(new URL('../app/public/setup.css', import.meta.url), new URL('../dist/setup/app.css', import.meta.url));
console.log('Built the owner and deployment review apps.');
