#!/usr/bin/env node
/** Regenerates the README screenshots in docs/screenshots/. Run: node scripts/screenshots.mjs */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const shots = [
  ['examples/sales/index.html', 'overview.png', 'light', 1400, 1100],
  ['examples/sales/pipeline.html', 'pipeline.png', 'light', 1400, 1000],
  ['examples/sales/products.html', 'products-dark.png', 'dark', 1400, 1100]
];
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const [page, file, scheme, width, height] of shots) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(resolve(page)).href);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `docs/screenshots/${file}` });
  await ctx.close();
  console.log('wrote docs/screenshots/' + file);
}
await browser.close();
