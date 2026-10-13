#!/usr/bin/env node
/**
 * Generates the deterministic demo data sets in examples/data/.
 * Run: node scripts/generate-sample-data.mjs
 * Output is plain JS that calls Atlas.registerData(), so pages work from file:// with no server.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'examples', 'data');
mkdirSync(out, { recursive: true });

// Small seeded PRNG (mulberry32) so the data never changes between runs.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261013);
const pick = (arr, weights) => {
  if (!weights) return arr[Math.floor(rand() * arr.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
};
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const iso = (d) => d.toISOString().slice(0, 10);

const geography = {
  'North America': { 'United States': ['New York', 'Chicago', 'Austin', 'Seattle'], Canada: ['Toronto', 'Vancouver'], Mexico: ['Mexico City'] },
  Europe: { Germany: ['Berlin', 'Munich'], 'United Kingdom': ['London', 'Manchester'], France: ['Paris', 'Lyon'] },
  'Asia Pacific': { Japan: ['Tokyo', 'Osaka'], Australia: ['Sydney', 'Melbourne'], Singapore: ['Singapore'] },
  'Latin America': { Brazil: ['São Paulo', 'Rio de Janeiro'], Chile: ['Santiago'] }
};
const regionWeights = { 'North America': 5, Europe: 4, 'Asia Pacific': 3, 'Latin America': 1.5 };
const products = [
  ['Atlas Analytics', 'Software', 1200], ['Atlas Reports', 'Software', 450], ['Atlas Cloud', 'Software', 2400],
  ['Onboarding', 'Services', 3000], ['Training', 'Services', 900], ['Premium Support', 'Support', 1500], ['Standard Support', 'Support', 600]
];
const channels = ['Direct', 'Partner', 'Online'];
const segments = ['Enterprise', 'Mid-Market', 'SMB'];
const customers = Array.from({ length: 60 }, (_, i) => `Customer ${String(i + 1).padStart(3, '0')}`);

// ---------------- Sales orders ----------------
const sales = [];
const start = new Date(Date.UTC(2024, 0, 1));
for (let i = 0; i < 2400; i++) {
  const day = Math.floor(rand() * 731);
  const date = new Date(start.getTime() + day * 864e5);
  const region = pick(Object.keys(geography), Object.values(regionWeights));
  const country = pick(Object.keys(geography[region]));
  const city = pick(geography[region][country]);
  const [product, category, price] = pick(products, [5, 4, 2, 1.5, 2, 1.5, 3]);
  const segment = pick(segments, [2, 3, 4]);
  const channel = pick(channels, [3, 2, 2.5]);
  const growth = 1 + day / 731 * 0.35;
  const season = 1 + 0.18 * Math.sin((date.getUTCMonth() / 12) * Math.PI * 2 - 1);
  const units = Math.max(1, Math.round((segment === 'Enterprise' ? 12 : segment === 'Mid-Market' ? 6 : 2) * (0.5 + rand()) * growth * season));
  const discount = round(pick([0, 0.05, 0.1, 0.15, 0.2], [5, 3, 2, 1, 0.5]), 2);
  const revenue = round(units * price * (1 - discount));
  const cost = round(revenue * (category === 'Software' ? 0.22 : category === 'Services' ? 0.62 : 0.45) * (0.85 + rand() * 0.3));
  sales.push({
    orderId: `SO-${String(10000 + i)}`, date: iso(date), region, country, city, channel, segment, category, product,
    customer: pick(customers), units, discount, revenue, cost, profit: round(revenue - cost)
  });
}
sales.sort((a, b) => a.date.localeCompare(b.date) || a.orderId.localeCompare(b.orderId));

// ---------------- Sales pipeline (opportunities) ----------------
const sources = ['Website', 'Events', 'Referral', 'Outbound', 'Partner'];
const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed'];
const pipeline = [];
for (let i = 0; i < 900; i++) {
  const source = pick(sources, [4, 2, 1.5, 3, 2]);
  const p = { Website: 0.55, Events: 0.65, Referral: 0.8, Outbound: 0.5, Partner: 0.7 }[source];
  let reached = 0;
  while (reached < stages.length - 1 && rand() < p + reached * 0.04) reached++;
  const won = reached === stages.length - 1 ? rand() < 0.6 : false;
  const outcome = reached === stages.length - 1 ? (won ? 'Won' : 'Lost') : 'Stalled';
  const day = Math.floor(rand() * 731);
  pipeline.push({
    opportunityId: `OP-${String(5000 + i)}`,
    created: iso(new Date(start.getTime() + day * 864e5)),
    source, region: pick(Object.keys(geography), Object.values(regionWeights)), segment: pick(segments, [2, 3, 4]),
    stage: stages[reached], stageIndex: reached + 1,
    outcome, amount: round((pick(segments, [2, 3, 4]) === 'Enterprise' ? 60000 : 18000) * (0.4 + rand()), 0),
    owner: pick(['A. Rivera', 'B. Chen', 'C. Okafor', 'D. Novak', 'E. Haddad'])
  });
}

function emit(name, rows, about) {
  const cols = Object.keys(rows[0]);
  // Columnar form keeps the file small; Atlas.registerData expands it to row objects.
  const body = `/* ${about}\n * Generated by scripts/generate-sample-data.mjs — do not edit by hand. ${rows.length} rows. */\n` +
    `Atlas.registerData(${JSON.stringify(name)}, {\n  columns: ${JSON.stringify(cols)},\n  rows: [\n` +
    rows.map((r) => '    ' + JSON.stringify(cols.map((c) => r[c]))).join(',\n') + '\n  ]\n});\n';
  writeFileSync(join(out, `${name}.js`), body);
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => {
    const v = String(r[c]);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(','))).join('\n');
  writeFileSync(join(out, `${name}.csv`), csv + '\n');
  console.log(`wrote ${name}.js / ${name}.csv (${rows.length} rows)`);
}
emit('sales', sales, 'Demo sales orders, Jan 2024 – Dec 2025.');
emit('pipeline', pipeline, 'Demo sales opportunities with source, furthest stage and outcome.');
