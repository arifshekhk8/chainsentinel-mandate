import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/ui', workers: 1, fullyParallel: false, timeout: 30000,
  use: { ...(process.env.CI ? {} : { channel: 'chrome' }), headless: true, viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: 'list',
});
