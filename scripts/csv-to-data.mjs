#!/usr/bin/env node
/**
 * Convert a CSV (or JSON array) export into an Atlas data script.
 *   node scripts/csv-to-data.mjs <input.csv> <dataset-name> [output.js]
 * Uses the same CSV parser as the browser Upload button, and writes the compact columnar form.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const [input, name, output] = process.argv.slice(2);
if (!input || !name) {
  console.error('Usage: node scripts/csv-to-data.mjs <input.csv|input.json> <dataset-name> [output.js]');
  process.exit(1);
}
// Load atlas.js in a sandbox with just enough DOM stubs to reach Atlas.util.parseCSV.
const sandbox = { document: { readyState: 'loading', addEventListener() {}, documentElement: { setAttribute() {} } } };
sandbox.window = sandbox;
runInNewContext(readFileSync(fileURLToPath(new URL('../atlas/atlas.js', import.meta.url)), 'utf8'), sandbox);

const text = readFileSync(input, 'utf8');
const rows = /^\s*[[{]/.test(text) ? [].concat(JSON.parse(text).rows || JSON.parse(text)) : sandbox.Atlas.util.parseCSV(text);
if (!rows.length) { console.error('No rows found in ' + input); process.exit(1); }
const columns = Object.keys(rows[0]);
const num = /^-?\d+(\.\d+)?$/;
const cell = (v) => (typeof v === 'string' && num.test(v.trim()) ? Number(v) : v);
const js = `/* Generated from ${input.split(/[\\/]/).pop()} by scripts/csv-to-data.mjs — ${rows.length} rows. */\n` +
  `Atlas.registerData(${JSON.stringify(name)}, {\n  columns: ${JSON.stringify(columns)},\n  rows: [\n` +
  rows.map((r) => '    ' + JSON.stringify(columns.map((c) => cell(r[c])))).join(',\n') + '\n  ]\n});\n';
if (output) { writeFileSync(output, js); console.log(`wrote ${output} (${rows.length} rows, ${columns.length} columns)`); }
else process.stdout.write(js);
