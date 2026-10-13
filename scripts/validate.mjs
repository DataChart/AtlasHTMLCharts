#!/usr/bin/env node
/**
 * Validates every dashboard page in the repo (or the paths you pass):
 *   - the data-atlas JSON block parses and matches schema/dashboard.schema.json
 *   - local files the page references (scripts, styles, logo, nav links) exist
 *   - the schema's visual types match the types registered in atlas/visuals.js
 *
 * Usage: node scripts/validate.mjs [file-or-folder ...]
 * Exit code 1 on any problem, so it works in CI and as a pre-commit check.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'schema/dashboard.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const SKIP = new Set(['node_modules', '.git', 'vendor', 'test-results', 'playwright-report']);
function htmlFiles(p) {
  const st = statSync(p);
  if (st.isFile()) return extname(p) === '.html' ? [p] : [];
  return readdirSync(p).filter((n) => !SKIP.has(n)).flatMap((n) => htmlFiles(join(p, n)));
}

const targets = process.argv.slice(2).map((p) => resolve(p));
const files = (targets.length ? targets : [root]).flatMap(htmlFiles);
let problems = 0;
const report = (file, msg) => { problems++; console.error(`✗ ${relative(root, file)}: ${msg}`); };
const isLocal = (u) => u && !/^(https?:|data:|mailto:|#|\/\/)/i.test(u);
const local = (file, u) => resolve(dirname(file), u.split(/[?#]/)[0]);

let dashboards = 0;
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script\s+type="application\/json"\s+data-atlas[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) continue;
  dashboards++;

  for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    if (isLocal(m[1]) && !existsSync(local(file, m[1]))) report(file, `missing file referenced by <script>/<link>: ${m[1]}`);
  }

  for (const [, body] of blocks) {
    let cfg;
    try { cfg = JSON.parse(body); } catch (e) { report(file, `config is not valid JSON: ${e.message}`); continue; }
    if (!validate(cfg)) {
      for (const err of validate.errors) {
        const extra = err.params && (err.params.additionalProperty || err.params.allowedValues);
        report(file, `config${err.instancePath || ''} ${err.message}${extra ? ` (${JSON.stringify(extra)})` : ''}`);
      }
    }
    if (cfg.logo && isLocal(cfg.logo) && !existsSync(local(file, cfg.logo))) report(file, `logo not found: ${cfg.logo}`);
    for (const n of cfg.nav || []) if (isLocal(n.href) && !existsSync(local(file, n.href))) report(file, `nav link not found: ${n.href}`);
    for (const v of cfg.visuals || []) {
      const dt = v.drillThrough && (v.drillThrough.href || v.drillThrough);
      if (typeof dt === 'string' && isLocal(dt) && !existsSync(local(file, dt))) report(file, `drillThrough target not found: ${dt}`);
    }
  }
}

// Schema enum <-> registered visuals must agree, so docs, schema and runtime never drift.
const src = readFileSync(join(root, 'atlas/visuals.js'), 'utf8');
const registered = new Set([...src.matchAll(/registerVisual\('([A-Za-z0-9]+)'/g)].map((m) => m[1]));
const cartesian = src.match(/var CARTESIAN = \{([\s\S]*?)\n {2}\};/);
if (cartesian) for (const m of cartesian[1].matchAll(/^\s+([A-Za-z0-9]+):/gm)) registered.add(m[1]);
registered.add('section');
const enumTypes = new Set(schema.$defs.visual.properties.type.enum);
for (const t of registered) if (!enumTypes.has(t)) { problems++; console.error(`✗ schema: visual type "${t}" is registered but missing from the schema enum`); }
for (const t of enumTypes) if (!registered.has(t)) { problems++; console.error(`✗ schema: visual type "${t}" is in the schema but not registered in atlas/visuals.js`); }
const docs = readFileSync(join(root, 'docs/config-reference.md'), 'utf8');
for (const t of enumTypes) if (!docs.includes('`' + t + '`')) { problems++; console.error(`✗ docs: visual type "${t}" is not documented in docs/config-reference.md`); }

if (problems) {
  console.error(`\n${problems} problem(s) in ${dashboards} dashboard page(s).`);
  process.exit(1);
}
console.log(`✓ ${dashboards} dashboard page(s) valid; ${enumTypes.size} visual types in sync with schema and docs.`);
