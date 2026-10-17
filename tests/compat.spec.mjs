import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { copyFileSync, rmSync } from 'node:fs';

const url = (p) => pathToFileURL(resolve(p)).href;

async function open(page, path) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url(path));
  await page.waitForSelector('.atlas-visual');
  return errors;
}

test('the template works unchanged after copying it into dashboards/', async ({ page }, info) => {
  const copy = `dashboards/_copy-test-${info.project.name}.html`;
  copyFileSync('templates/dashboard.html', copy);
  try {
    const errors = await open(page, copy);
    expect(errors, errors.join('\n')).toEqual([]);
    await expect(page.locator('.atlas-visual [role=alert]')).toHaveCount(0);
    await expect(page.locator('.atlas-nav a[aria-current="page"]')).toHaveText(['Overview']);
  } finally {
    rmSync(copy, { force: true });
  }
});

test('dates with a space or a zone parse the same in every browser', async ({ page }) => {
  await open(page, 'templates/dashboard.html');
  const r = await page.evaluate(() => {
    const p = window.Atlas.util.parseDate;
    const local = p('2024-03-05 13:45');
    return {
      dateOnly: p('2024-03-05').getDate(),
      local: [local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes()],
      tLocal: p('2024-03-05T13:45:30').getSeconds(),
      utc: p('2024-03-05T13:45:00Z').toISOString(),
      offset: p('2024-03-05T13:45:00+05:30').toISOString(),
      bad: p('not a date')
    };
  });
  expect(r.dateOnly).toBe(5);
  expect(r.local).toEqual([2024, 2, 5, 13, 45]);
  expect(r.tLocal).toBe(30);
  expect(r.utc).toBe('2024-03-05T13:45:00.000Z');
  expect(r.offset).toBe('2024-03-05T08:15:00.000Z');
  expect(r.bad).toBeNull();
});

test('min and max work on more values than a function call can take', async ({ page }) => {
  await open(page, 'templates/dashboard.html');
  const r = await page.evaluate(() => {
    const vals = Array.from({ length: 200000 }, (_, i) => i - 1000);
    const a = window.Atlas.util.aggregates;
    return [a.min(vals), a.max(vals), a.max([]), a.min(['x', null])];
  });
  expect(r).toEqual([-1000, 198999, null, null]);
});

test('Escape closes an open menu and returns focus to its button', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const menu = page.locator('.atlas-menu');
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open', '');
  await page.getByRole('menuitem', { name: 'Filtered data (CSV)' }).focus();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(menu.locator('summary')).toBeFocused();
});

test('the download menu works from the keyboard alone', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const menu = page.locator('.atlas-menu');
  const items = menu.getByRole('menuitem');
  await menu.locator('summary').focus();
  await page.keyboard.press('ArrowDown');
  await expect(menu).toHaveAttribute('open', '');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(items.last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(items.last()).toBeFocused();
  const [cfg] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(cfg.suggestedFilename()).toBe('sales-overview.atlas.json');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(menu.locator('summary')).toBeFocused();
});

test('the multi-select slicer works from the keyboard alone', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const dd = page.locator('.atlas-filter', { hasText: 'Region' }).locator('details');
  const summary = dd.locator('summary');
  await expect(summary).toHaveAccessibleName(/^Region\s+All$/);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(dd).toHaveAttribute('open', '');
  const boxes = dd.locator('input[type=checkbox]');
  await expect(boxes.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(boxes.nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(boxes.nth(1)).toBeChecked();
  await expect(summary).not.toContainText('All');
  // Tabbing past the last control leaves the popup and closes it.
  await dd.getByRole('button', { name: 'Clear' }).focus();
  await page.keyboard.press('Tab');
  await expect(dd).not.toHaveAttribute('open', '');
});

test('stacked series values match a direct sum', async ({ page }) => {
  await open(page, 'examples/sales/index.html');
  const r = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.atlas-visual')].find((v) => v.textContent.includes('Revenue by quarter and channel'));
    const opt = window.echarts.getInstanceByDom(el.querySelector('.atlas-chart')).getOption();
    const charted = opt.series.reduce((s, ser) => s + ser.data.reduce((t, d) => t + ((d && typeof d === 'object' ? d.value : d) || 0), 0), 0);
    const direct = window.Atlas.getData('sales').reduce((s, row) => s + row.revenue, 0);
    return [Math.round(charted), Math.round(direct)];
  });
  expect(r[0]).toBe(r[1]);
});
