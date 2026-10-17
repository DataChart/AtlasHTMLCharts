import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = (p) => pathToFileURL(resolve(p)).href;

const PAGES = [
  'gallery/index.html',
  'templates/dashboard.html',
  'examples/sales/index.html',
  'examples/sales/products.html',
  'examples/sales/pipeline.html',
  'examples/sales/details.html'
];

/** Open a page and collect console errors / uncaught exceptions. */
async function open(page, path) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(typeof path === 'string' && path.startsWith('file:') ? path : url(path));
  await page.waitForSelector('.atlas-visual');
  await page.waitForTimeout(300);
  return errors;
}

const visual = (page, title) => page.locator('.atlas-visual', { has: page.locator('.atlas-visual__title', { hasText: title }) }).first();
const cardValue = (page, title) => visual(page, title).locator('.atlas-card__value').first().textContent();

/** Click a data point of an ECharts visual by asking the chart where it drew it. */
async function clickChart(page, title, locate) {
  await visual(page, title).scrollIntoViewIfNeeded();
  const box = await visual(page, title).locator('.atlas-chart').first().boundingBox();
  const pt = await visual(page, title).locator('.atlas-chart').first().evaluate((el, src) => {
    const chart = window.echarts.getInstanceByDom(el);
    return new Function('chart', src)(chart);
  }, locate);
  await page.mouse.click(box.x + pt[0], box.y + pt[1]);
  await page.waitForTimeout(200);
}
const PIE_SLICE = (i) => `
  const l = chart.getModel().getSeriesByIndex(0).getData().getItemLayout(${i});
  const a = (l.startAngle + l.endAngle) / 2, r = (l.r + (l.r0 || 0)) / 2;
  return [l.cx + r * Math.cos(a), l.cy + r * Math.sin(a)];`;

for (const path of PAGES) {
  test(`renders without errors: ${path}`, async ({ page }) => {
    const errors = await open(page, path);
    expect(errors, errors.join('\n')).toEqual([]);
    await expect(page.locator('.atlas-visual [role=alert]')).toHaveCount(0);
    // Every chart visual actually drew something.
    const charts = page.locator('.atlas-visual .atlas-chart');
    const n = await charts.count();
    for (let i = 0; i < n; i++) await expect(charts.nth(i).locator('canvas, svg').first()).toBeAttached();
    await expect(page.locator('.atlas-header .atlas-logo')).toBeVisible();
  });
}

test('every registered visual type appears in the gallery', async ({ page }) => {
  await open(page, 'gallery/index.html');
  const types = await page.evaluate(() => window.Atlas.visualTypes());
  const used = await page.$$eval('.atlas-visual', (els) => els.map((e) => e.dataset.visualType));
  const aliases = new Set(['bar', 'column', 'combo', 'bubble', 'html']);
  for (const t of types) if (!aliases.has(t)) expect(used, `gallery is missing "${t}"`).toContain(t);
});

test('navigation marks only the current page active', async ({ page }) => {
  await open(page, 'examples/sales/products.html');
  await expect(page.locator('.atlas-nav a[aria-current="page"]')).toHaveText(['Products']);
});

test('dropdown slicer filters every visual', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const before = await cardValue(page, 'Profit');
  const dd = page.locator('.atlas-filter', { hasText: 'Region' }).locator('details');
  await dd.locator('summary').click();
  await dd.locator('label', { hasText: 'Europe' }).click();
  await expect(dd.locator('summary')).toContainText('Europe');
  expect(await cardValue(page, 'Profit')).not.toEqual(before);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  expect(await cardValue(page, 'Profit')).toEqual(before);
});

test('button slicer and date preset filter the data', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const before = await cardValue(page, 'Orders');
  await page.locator('.atlas-tile', { hasText: 'Online' }).click();
  await expect(page.locator('.atlas-tile', { hasText: 'Online' })).toHaveAttribute('aria-pressed', 'true');
  const afterTile = await cardValue(page, 'Orders');
  expect(afterTile).not.toEqual(before);
  await page.locator('.atlas-filter', { hasText: 'Order date' }).locator('select').selectOption('90d');
  expect(await cardValue(page, 'Orders')).not.toEqual(afterTile);
});

test('clicking a bar cross-filters the page and the chip clears it', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const before = await cardValue(page, 'Profit');
  await clickChart(page, 'Top products', `
    const opt = chart.getOption(); const v = opt.series[0].data[0];
    return chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [(typeof v === 'object' ? v.value : v) / 2, 0]);`);
  const chip = page.locator('.atlas-chip');
  await expect(chip).toContainText('Product: Atlas Analytics');
  expect(await cardValue(page, 'Profit')).not.toEqual(before);
  await chip.click();
  await expect(chip).toHaveCount(0);
  expect(await cardValue(page, 'Profit')).toEqual(before);
});

test('drill-down pie drills by level and walks back with the breadcrumb', async ({ page }) => {
  await open(page, 'gallery/index.html');
  const v = visual(page, 'drillPie');
  await expect(v.locator('.atlas-breadcrumb')).toHaveText(/^All/);
  await clickChart(page, 'drillPie', PIE_SLICE(0));
  await expect(v.locator('.atlas-breadcrumb')).toContainText('›');
  const legend = await v.locator('.atlas-chart').evaluate((el) => window.echarts.getInstanceByDom(el).getOption().series[0].data.map((d) => d.name));
  expect(legend).toContain('Atlas Analytics');
  await v.locator('.atlas-breadcrumb button', { hasText: 'All' }).click();
  await expect(v.locator('.atlas-breadcrumb button')).toHaveCount(0);
});

test('drill-through opens the target page filtered, with a removable chip', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const geo = 'Revenue by geography';
  await clickChart(page, geo, PIE_SLICE(0));
  await clickChart(page, geo, PIE_SLICE(0));
  await Promise.all([page.waitForURL(/details\.html\?/), clickChart(page, geo, PIE_SLICE(0))]);
  await page.waitForSelector('.atlas-visual');
  await expect(page.locator('.atlas-chip')).toHaveCount(3);
  const cities = await page.locator('.atlas-visual[data-visual-type=table] tbody tr td:nth-child(3)').allTextContents();
  expect(cities.length).toBeGreaterThan(0);
  expect(new Set(cities).size).toBe(1);
});

test('URL parameters act as page filters', async ({ page }) => {
  await open(page, url('examples/sales/details.html') + '?region=Europe&date:year=2025');
  await expect(page.locator('.atlas-chip')).toHaveCount(2);
  const dates = await page.locator('.atlas-visual[data-visual-type=table] tbody tr td:nth-child(2)').allTextContents();
  expect(dates.length).toBeGreaterThan(0);
  expect(dates.every((d) => d.includes('2025'))).toBe(true);
});

test('upload replaces the data set', async ({ page }) => {
  await open(page, 'examples/sales/details.html');
  const csv = 'orderId,date,region,city,customer,product,units,discount,revenue,profit\n' +
    'X-1,2026-01-05,Europe,Paris,Acme,Widget,2,0,100,40\nX-2,2026-01-06,Europe,Lyon,Acme,Widget,3,0.1,"1,250.50",500\n';
  await page.locator('.atlas-toolbar input[type=file]').setInputFiles({ name: 'mine.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.atlas-toast')).toContainText('Loaded 2 rows');
  expect(await cardValue(page, 'Revenue')).toBe('$1,351');
});

test('download menu exports filtered CSV and config', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  await page.locator('.atlas-menu summary').click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Filtered data (CSV)' }).click()]);
  expect(csv.suggestedFilename()).toBe('sales-overview-filtered.csv');
  await page.locator('.atlas-menu summary').click();
  const [cfg] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Dashboard config (JSON)' }).click()]);
  expect(cfg.suggestedFilename()).toBe('sales-overview.atlas.json');
});

test('per-visual data table, PNG and CSV', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const v = visual(page, 'Top products');
  await v.getByRole('button', { name: 'Show data table' }).click();
  await expect(v.locator('.atlas-dataview table')).toBeVisible();
  await expect(v.locator('.atlas-dataview tbody tr')).toHaveCount(7);
  const [png] = await Promise.all([page.waitForEvent('download'), v.getByRole('button', { name: 'Download image (PNG)' }).click()]);
  expect(png.suggestedFilename()).toBe('top-products.png');
  const [csv] = await Promise.all([page.waitForEvent('download'), v.getByRole('button', { name: 'Download data (CSV)' }).click()]);
  expect(csv.suggestedFilename()).toBe('top-products.csv');
});

test('print button fills the filter summary and calls print', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.locator('.atlas-tile', { hasText: 'Direct' }).click();
  await page.getByRole('button', { name: 'Print' }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(true);
  await expect(page.locator('.atlas-print-summary')).toContainText('Channel: Direct');
});

test('theme toggle switches to dark and recolours charts', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  await page.getByRole('button', { name: 'Toggle light / dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(13, 13, 13)');
});

test('a bad field name shows a readable error instead of breaking the page', async ({ page }) => {
  await page.goto(url('templates/dashboard.html'));
  await page.evaluate(() => {
    document.getElementById('atlas').remove();
    window.Atlas.dashboard({ data: 'starter', title: 'x', visuals: [{ type: 'bar', title: 'Broken', category: 'nope', value: 'tickets' }, { type: 'card', title: 'Fine', value: 'tickets' }] });
  });
  await expect(visual(page, 'Broken').locator('[role=alert]')).toContainText('Field not found in data: nope');
  await expect(visual(page, 'Fine').locator('.atlas-card__value')).toBeVisible();
});

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`charts animate only without a reduced-motion preference: ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await open(page, 'examples/sales/index.html');
    const el = visual(page, 'Revenue by quarter and channel').locator('.atlas-chart').first();
    const animation = await el.evaluate((node) => window.echarts.getInstanceByDom(node).getOption().animation);
    expect(animation).toBe(reducedMotion !== 'reduce');
  });
}
