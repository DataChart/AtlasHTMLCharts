# AGENTS.md — instructions for AI assistants

This file tells an AI coding assistant (Claude, Copilot, Cursor, ChatGPT, …) how to build and change
dashboards in this repository. Humans can read it too: it is the shortest complete description of the conventions.

## What this repository is

Atlas HTML Charts turns a **JSON config** into a complete business dashboard page: logo, navigation,
upload/download/print buttons, slicers and a grid of visuals. A dashboard is **one HTML file** plus a data file.
There is no build step, no framework and no server: the page opens straight from disk.

```
atlas/atlas.css        tokens, layout, components (never edit for one dashboard; use a theme)
atlas/atlas.js         runtime: header, filters, data, formatting, interactions
atlas/visuals.js       every visual type (Power BI set + Sankey, drill pie, …)
vendor/echarts/        Apache ECharts 5.6.0, vendored so pages work offline
templates/dashboard.html   the starting point for every new dashboard
gallery/index.html     every visual and filter, live — copy JSON from here
examples/sales/        a 4-page example with drill-through between pages
schema/dashboard.schema.json   JSON Schema for the config block
docs/config-reference.md       every option, every visual
prompts/               reusable prompts for common dashboard tasks
dashboards/            where users keep their own dashboards
```

## The golden rules

1. **Build dashboards by writing config, not code.** A new dashboard = copy `templates/dashboard.html` into
   `dashboards/`, change the data `<script>` and the JSON block. Do not write chart code, inline `<style>` or
   custom JavaScript in a dashboard page unless the user explicitly asks for something the config cannot do.
2. **Use only documented keys and types.** The schema rejects unknown keys. If you need a capability that
   doesn't exist, add it to the framework (see "Changing the framework") rather than hacking one page.
3. **Use field names exactly as they appear in the data.** Before writing a config, list the data's columns
   (read the first lines of the CSV / data file). A wrong field name renders an error card that names the
   available fields.
4. **Pick the visual by the question it answers** (table below), not for variety.
5. **Keep relative paths working.** Pages in `dashboards/` reference `../atlas/...`, `../vendor/...`, `../assets/...`.
6. **Validate before you finish:** `npm run validate` (schema + file references) and, if you changed the
   framework, `npm test` (browser tests).

## Workflow for "make me a dashboard for X"

1. Read the data: column names, types (number / ISO date / text), a few rows, row count.
2. Decide 3–8 questions the page answers. Put the single most important number top-left.
3. Copy `templates/dashboard.html` to `dashboards/<slug>.html`. Update `<title>`, the data `<script src>`, and the JSON.
4. Fill `fields` with labels and formats for every measure (`currency`, `percent`, `integer`, …).
5. Add filters for the dimensions people slice by most (date range first, then 2–4 dropdowns/buttons).
6. Lay out visuals in reading order on the 12-column grid. Rows should add up to 12:
   - KPI row: 4 × `span: 3` cards/KPIs.
   - Main trend: `span: 8` + supporting breakdown `span: 4`.
   - Detail: `span: 6` + `span: 6`, then a full-width `table` or `matrix` (`span: 12`).
7. For multi-page dashboards, give every page the same `nav` array and logo; use `drillThrough` to link a
   summary visual to a detail page.
8. Run `npm run validate`. Open the page (or the gallery) to check it renders.

## Choosing a visual

| The question | Use |
|---|---|
| One headline number | `card`; vs a goal → `kpi` (with `trend`) or `gauge` |
| Compare categories | `bar` (long labels, many items) or `column` (few items, time-like) |
| Composition across categories | `stackedBar` / `stackedColumn`; shares → the `100` variants |
| Change over time | `line` (several series) or `area` (one series) |
| Two measures over time | `lineClusteredColumn` (shared axis) — or two charts if the scales differ |
| Part of a whole, ≤ 7 parts | `donut` or `pie`; hierarchical → `drillDonut`, `treemap`, `sunburst` |
| Flow between stages / systems | `sankey` |
| Conversion through ordered stages | `funnel` (`order` + `cumulative` for furthest-stage data) |
| What adds up to a total | `waterfall` |
| Why is a number what it is | `decompositionTree` |
| Relationship between two measures | `scatter` (`size` makes it a bubble chart) |
| Pattern across two dimensions | `heatmap` |
| Exact values / look-ups | `table` (raw or `groupBy`) or `matrix` (pivot) |
| Explain the numbers in words | `text` with `{{sum:field}}` tokens |

## Design rules the framework already enforces (don't fight them)

- Colours come from CSS tokens. Series colours follow the entity (the same region is the same colour on every chart)
  and are capped at 8; extra series fold into "Other". Don't add per-visual colours.
- One value axis per chart. There is no dual-axis option.
- Light and dark themes are both supported; brand changes go in a theme file (`docs/theming.md`).
- Every chart has a data-table view, PNG and CSV download; KPIs show status with an icon and words.

## Changing the framework

- New visual type: add a `registerVisual` block in `atlas/visuals.js` (see `docs/extending.md`), add the type to
  the schema enum and `$defs.visual.properties`, document it in `docs/config-reference.md`, add it to
  `gallery/index.html`. `npm run validate` fails if the schema, docs and runtime disagree; `npm test`
  fails if the gallery is missing a registered type.
- Keep `atlas/*.js` dependency-free ES5-style browser code (no modules, no build). It must run from `file://`.
- Sample data is generated: edit `scripts/generate-sample-data.mjs`, then `npm run data`.

## Commands

```bash
npm install          # dev tools only (validator + browser tests); dashboards need nothing installed
npm run validate     # schema + file-reference check for every dashboard page
npm test             # validate + Playwright tests in Chromium, Firefox and WebKit
npm run test:chromium  # the same, Chromium only (fastest local check)
npm run serve        # optional local server on http://localhost:8080
```
