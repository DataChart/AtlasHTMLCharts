# Config reference

Every Atlas page is driven by one JSON block:

```html
<script type="application/json" data-atlas>
{ "title": "…", "data": "sales", "filters": [ … ], "visuals": [ … ] }
</script>
```

The block must be valid JSON (double quotes, no trailing commas, no comments). It is validated against
[`schema/dashboard.schema.json`](../schema/dashboard.schema.json) by `npm run validate`. Add
`"$schema": "../schema/dashboard.schema.json"` at the top if you want autocomplete in VS Code.

- [Page settings](#page-settings)
- [Fields](#fields)
- [Measures and aggregation](#measures-and-aggregation)
- [Formats](#formats)
- [Filters (slicers)](#filters-slicers)
- [Visuals: common options](#visuals-common-options)
- [Visual catalogue](#visual-catalogue)
- [Interactions: cross-filter, drill-down, drill-through](#interactions)

---

## Page settings

| Key | Type | Default | What it does |
|---|---|---|---|
| `title` | string | — | Title next to the logo. Also used for download file names. |
| `subtitle` | string | — | Small line under the title. |
| `logo` | string \| `false` | `"assets/logo.svg"` | Path to the logo shown top-left, relative to the HTML file. Drop in any SVG/PNG. If the file is missing, the image is hidden. |
| `logoAlt` | string | title | Alt text for the logo. |
| `logoHref` | string | — | Makes the logo a link (usually your home page). |
| `nav` | array | `[]` | Top navigation: `[{ "label": "Overview", "href": "index.html" }]`. The current page is highlighted automatically; force it with `"active": true`. |
| `toolbar` | object | all on | `{ "upload": true, "download": true, "print": true, "theme": true }`. Rename buttons with `uploadLabel`, `downloadLabel`, `printLabel`. Add link buttons with `"custom": [{ "label": "Help", "href": "help.html" }]`. |
| `header` | boolean | `true` | `false` hides the whole header (for embedding). |
| `data` | string \| array | — | Name of a data set registered with `Atlas.registerData()`, or inline rows. |
| `fields` | object | inferred | Labels, types and formats per field. See [Fields](#fields). |
| `filters` | array | `[]` | The slicer bar. See [Filters](#filters-slicers). |
| `visuals` | array | `[]` | The grid of visuals, in reading order. |
| `currency` | string | `"USD"` | ISO currency code for the `currency` formats. |
| `locale` | string | browser | Number/date locale, e.g. `"de-DE"`. |
| `crossFilter` | boolean | `true` | `false` turns off click-to-filter for the whole page. |
| `renderer` | `"canvas"` \| `"svg"` | `"canvas"` | ECharts renderer. |

### Toolbar buttons

- **Upload** loads a `.csv` or `.json` file (array of objects, or `{ "rows": [...] }`) and replaces the page's data. Files can also be dragged onto the page. Nothing leaves the browser.
- **Download** offers *Filtered data (CSV)*, *All data (CSV)*, *Filtered data (JSON)* and *Dashboard config (JSON)*.
- **Print** opens the browser print dialog (use *Save as PDF* for a PDF). Navigation and buttons are hidden and a line listing the active filters is printed at the top.
- **Theme** toggles light/dark and remembers the choice.

Each visual also has its own buttons: **Show data table** (accessible alternative to the chart), **Download image (PNG)** and **Download data (CSV)**. Hide them with `"actions": false`.

## Fields

Atlas reads the data and infers each column's type: `number`, `date` (ISO `YYYY-MM-DD` or ISO timestamps) or `string`. Override or decorate fields here:

```json
"fields": {
  "revenue": { "label": "Revenue", "format": "currency" },
  "orderDate": { "type": "date" },
  "zip": { "type": "string" }
}
```

Labels default to a humanised field name (`orderDate` → "Order date").

## Measures and aggregation

Anywhere a visual takes a value (`value`, `values`, `x`, `y`, `size`, `columns`, `lines`, `target`) you can write:

- a field name: `"revenue"` — summed if numeric, counted otherwise;
- an object: `{ "field": "revenue", "agg": "avg", "label": "Avg. order", "format": "currency" }`.

`agg` is one of `sum`, `avg`, `min`, `max`, `median`, `count`, `distinct`. Omit `value` entirely to count rows.

## Formats

`number` (default for numbers), `integer`, `decimal` (2 dp), `currency`, `compactCurrency` ($1.2M), `percent` (0.25 → 25%), `compact` (1.2K), `date`, `month`, `datetime`, `text`. Register your own with `Atlas.registerFormat("bps", v => (v * 10000).toFixed(0) + " bps")`.

## Filters (slicers)

Filters sit in one row above the visuals and apply to every visual on the page.

| `type` | Power BI equivalent | Options |
|---|---|---|
| `dropdown` | Dropdown slicer | `field`, `multiple` (default `true`), `options` (explicit order), `allLabel`, `default` |
| `list` | Vertical list slicer | `field`, `options`, `default` |
| `buttons` | Tile slicer | `field`, `multiple` (default `true`), `options`, `default` |
| `dateRange` | Between / relative date slicer | `field`, `default`: `all` `7d` `30d` `90d` `12m` `mtd` `qtd` `ytd` or `{ "from": "2025-01-01", "to": "2025-06-30" }` |
| `range` | Numeric range slicer | `field`, `step`, `default`: `{ "min": 0, "max": 100 }` |
| `search` | Text filter | `fields` (array) or `field`, `placeholder` |

All filters take `label` and an optional `id`. Relative date presets are anchored to the **latest date in the data**, so a static extract still shows sensible "last 90 days".

A **visual-level filter** narrows one visual only: `"filter": { "status": "Escalated" }` or `{ "region": ["Europe", "Asia Pacific"] }`.

## Visuals: common options

| Key | What it does |
|---|---|
| `type` | Required. See the catalogue below. |
| `title`, `subtitle` | Card heading. |
| `span` | Width in a 12-column grid (1–12). Each type has a sensible default. On tablets small spans widen to 6; on phones everything is full width. |
| `height` | Chart height in px (default 320). |
| `category` | Field for the category axis / slices. |
| `grain` | For date categories: `day`, `week`, `month` (default), `quarter`, `year`. |
| `series` | Field to split into coloured series (the Power BI "Legend" well). More than 8 series fold into "Other". |
| `value` / `values` | One measure, or several measures shown side by side. |
| `sort` | `desc` (default for categories), `asc`, `category` (alphabetical/chronological, default for dates), `none` (data order), or an explicit array of keys. |
| `top` | Keep the top N categories; the rest become "Other". |
| `labels` | `true` shows value labels on bars/columns. |
| `format` | Override the measure's format. |
| `filter` | Visual-level filter (see above). |
| `drillThrough` | `{ "href": "details.html" }` — clicking a mark opens that page filtered to it. |
| `crossFilter` | `false` stops this visual from filtering the others when clicked. |
| `actions` | `false` hides the table/PNG/CSV buttons. |

Use `{ "type": "section", "title": "Revenue" }` to put a full-width heading in the grid.

## Visual catalogue

Each entry lists the keys that type reads. Every one is shown live in [`gallery/index.html`](../gallery/index.html).

### Bar and column

| Type | Power BI name | Keys |
|---|---|---|
| `bar` / `clusteredBar` | Clustered bar chart | `category`, `value`/`values` or `series`, `top`, `labels` |
| `stackedBar` | Stacked bar chart | `category`, `series`, `value` |
| `stackedBar100` | 100% stacked bar chart | `category`, `series`, `value` |
| `column` / `clusteredColumn` | Clustered column chart | `category`, `value`/`values` or `series` |
| `stackedColumn` | Stacked column chart | `category`, `series`, `value` |
| `stackedColumn100` | 100% stacked column chart | `category`, `series`, `value` |

```json
{ "type": "stackedColumn", "title": "Revenue by quarter", "category": "date", "grain": "quarter", "series": "channel", "value": "revenue", "span": 6 }
```

### Line and area

| Type | Power BI name | Keys |
|---|---|---|
| `line` | Line chart | `category`, `grain`, `value`/`values` or `series`, `smooth` |
| `area` | Area chart | same as `line` |
| `stackedArea` | Stacked area chart | `category`, `series`, `value` |
| `stackedArea100` | 100% stacked area chart | `category`, `series`, `value` |
| `combo` / `lineClusteredColumn` | Line and clustered column chart | `category`, `columns` (measures), `lines` (measures), optional `series` |
| `lineStackedColumn` | Line and stacked column chart | `category`, `series`, `columns`, `lines` |

Combo charts use **one shared value axis** on purpose: two y-axes make unrelated scales look comparable. If the line is on a different scale, give it its own chart.

```json
{ "type": "lineClusteredColumn", "category": "date", "grain": "quarter", "columns": ["revenue"], "lines": ["profit"] }
```

### Part-to-whole

| Type | Power BI name | Keys |
|---|---|---|
| `pie` | Pie chart | `category`, `value`, `top` (default 7, rest → "Other") |
| `donut` | Donut chart | same; shows the total in the centre |
| `drillPie` | Pie with drill-down | `levels` (array of fields), `value`, `drillThrough` |
| `drillDonut` | Donut with drill-down | same as `drillPie` |
| `treemap` | Treemap | `levels` (or `category`), `value`. Multiple levels zoom on click. |
| `sunburst` | (custom visual) | `levels`, `value` |

```json
{ "type": "drillDonut", "title": "Revenue by geography", "levels": ["region", "country", "city"], "value": "revenue",
  "drillThrough": { "href": "details.html" } }
```

Click a slice to go one level down; the breadcrumb above the chart walks back up. At the last level a click cross-filters the page, or with `drillThrough` opens the target page filtered to the whole path (e.g. `details.html?region=Europe&country=France&city=Paris`).

### Flow and process

| Type | Power BI name | Keys |
|---|---|---|
| `sankey` | Sankey (AppSource visual) | `levels` (flow left→right through fields) **or** `source` + `target` (edge list, must be acyclic), `value`, `nodeAlign` |
| `funnel` | Funnel | `category`, `value`, `order` (stage order), `cumulative` |
| `waterfall` | Waterfall chart | `category`, `value`, `total`, `totalLabel`, `increaseLabel`, `decreaseLabel` |
| `decompositionTree` | Decomposition tree | `levels`, `value`, `rootLabel` |

```json
{ "type": "sankey", "title": "Opportunity flow", "levels": ["source", "stage", "outcome"] }
{ "type": "funnel", "category": "stage", "order": ["Lead", "Qualified", "Proposal", "Closed"], "cumulative": true }
```

Use `cumulative: true` when each row records the *furthest* stage reached (typical CRM extract): each stage then counts everything that got at least that far.

### Distribution and correlation

| Type | Power BI name | Keys |
|---|---|---|
| `scatter` / `bubble` | Scatter chart | `x`, `y` (measures), `size` (optional), `details` (field to aggregate points by), `series` (≤ 3 colours, rest → "Other") |
| `heatmap` | Matrix with background colour scale | `x`, `y` (fields), `grain`, `value`, `xOrder`, `yOrder`, `labels` |

### Single numbers

| Type | Power BI name | Keys |
|---|---|---|
| `card` | Card | `value`, `label` |
| `multiRowCard` | Multi-row card | `values` |
| `kpi` | KPI | `value`, `target` (number or measure), `higherIsBetter`, `trend` (date field for the sparkline), `grain`, `goodLabel`, `badLabel` |
| `gauge` | Gauge | `value`, `min`, `max` (number or measure), `target` |

Status in a KPI is always an icon plus words, never colour alone.

### Tables and text

| Type | Power BI name | Keys |
|---|---|---|
| `table` | Table | Raw rows: `columns` (fields), `totals`, `limit`. Grouped: `groupBy` + `columns` (measures). Both: `sort: { "field", "dir" }`, `dataBars` |
| `matrix` | Matrix | `rows` (fields), `columns` (one field, optional), `value`/`values`, `totals`, `dataBars`, `columnOrder` |
| `text` | Text box / Smart narrative | `text` with live tokens: `{{sum:revenue}}`, `{{avg:discount\|percent}}`, `{{distinct:customer}}`, `{{rows}}`; `**bold**` |
| `html` | (custom) | `html` — raw trusted HTML |
| `section` | — | `title` — full-width heading |

Tables sort when you click a header. They show up to `limit` rows (default 100); CSV download always has every row.

## Interactions

- **Cross-filter.** Clicking a bar, slice, node or cell filters every *other* visual to that value (the clicked visual dims the rest). A chip above the grid shows the selection; click it, or click the same mark again, to clear.
- **Drill-down.** `drillPie`, `drillDonut`, `treemap` (with several `levels`), `sunburst` and `decompositionTree` drill in place.
- **Drill-through.** Any category visual with `"drillThrough": { "href": "page.html" }` navigates to that page with the clicked value in the URL. The target page applies every `?field=value` (or `?field:grain=key`, e.g. `?date:month=2025-03`) whose field exists as a removable filter chip. Active cross-filters are passed along unless `"keepFilters": false`.
- **Links into a dashboard.** The same URL parameters work from anywhere: `sales.html?region=Europe` opens the page pre-filtered.
