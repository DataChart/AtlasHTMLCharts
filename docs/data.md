# Data

Atlas works on one flat table per page: an array of row objects.

## Ways to provide data

| Method | When to use |
|---|---|
| **Data script** — `Atlas.registerData("sales", rows)` in a `.js` file loaded with `<script src>` | Default. Works from `file://` with no server. |
| **Compact data script** — `Atlas.registerData("sales", { columns: [...], rows: [[...], ...] })` | Large extracts; about half the size. |
| **Inline** — `"data": [ {...}, {...} ]` in the config | Tiny static tables. |
| **Upload button / drag and drop** — `.csv` or `.json` | Ad-hoc analysis, or letting viewers refresh the numbers themselves. |

A browser will not `fetch()` a local `.json` or `.csv` file from a page opened via `file://`, which is why data is wrapped in a
small `.js` file. If you serve the folder over HTTP you can load data any way you like and call
`Atlas.dashboard(config)` yourself.

## Converting a CSV

```bash
node scripts/csv-to-data.mjs my-export.csv sales dashboards/sales-data.js
```

then load it with `<script src="sales-data.js"></script>` and set `"data": "sales"`. The script uses the same
CSV parser as the Upload button (quoted fields, `;` or tab delimiters, UTF-8 BOM).

## Types

Column types are inferred from the values:

- **number** — `12`, `-3.5`, `1,250.75` (thousands separators are stripped)
- **date** — ISO `2025-03-14` or ISO timestamps `2025-03-14T09:30:00Z`
- **string** — everything else

Force a type with `"fields": { "postcode": { "type": "string" } }`. Empty cells are treated as blank
(shown as "(Blank)" in categories, ignored by sums and averages).

## Shaping tips

- **Long beats wide.** One row per order/ticket/event with a date column beats one column per month.
- **Furthest stage.** For funnels from CRM data, one row per opportunity with its furthest stage works with
  `"cumulative": true`.
- **Flows.** For a Sankey, either one row per item with a column per stage (`levels`), or an edge list
  with `source`, `target` and a value.
- **Precompute heavy joins** in your database or Power Query; Atlas aggregates comfortably up to a few hundred
  thousand rows in the browser.
