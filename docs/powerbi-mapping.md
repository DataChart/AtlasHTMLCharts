# Coming from Power BI

Atlas uses Power BI's vocabulary where it can, so a report can be rebuilt page by page.

## Concepts

| Power BI | Atlas |
|---|---|
| Report page | One HTML file; pages are linked with `nav` |
| Page navigator / buttons | `nav` in the header |
| Dataset / model | One flat table per page via `Atlas.registerData()` (denormalise in Power Query / SQL first) |
| Measure (`SUM`, `AVERAGE`, `DISTINCTCOUNT`) | `{ "field": "x", "agg": "sum" \| "avg" \| "distinct" … }` |
| Axis / Category well | `category` (+ `grain` for date hierarchy level) |
| Legend well | `series` |
| Values well | `value` / `values` |
| Small multiples | Repeat the visual with a visual-level `filter` per value |
| Slicer | `filters` (dropdown, list, buttons/tiles, between date, numeric range, search) |
| Page filter | URL parameter `?field=value`, or a `default` on a filter |
| Visual-level filter | `"filter": { "field": "value" }` on the visual |
| Cross-filter / cross-highlight | Built in: click a mark (`crossFilter: false` to disable) |
| Drill down | `drillPie`, `drillDonut`, `treemap`/`sunburst` with `levels`, `decompositionTree` |
| Drill through | `"drillThrough": { "href": "detail-page.html" }` |
| Export data | Per-visual CSV button, page-level *Download* menu |
| Theme JSON | A CSS theme file overriding tokens (`docs/theming.md`) |
| Bookmarks | Links with URL parameters |

## Visuals

| Power BI visual | Atlas `type` |
|---|---|
| Stacked bar chart | `stackedBar` |
| Stacked column chart | `stackedColumn` |
| Clustered bar chart | `clusteredBar` (alias `bar`) |
| Clustered column chart | `clusteredColumn` (alias `column`) |
| 100% stacked bar chart | `stackedBar100` |
| 100% stacked column chart | `stackedColumn100` |
| Line chart | `line` |
| Area chart | `area` |
| Stacked area chart | `stackedArea` |
| 100% stacked area chart | `stackedArea100` |
| Line and stacked column chart | `lineStackedColumn` (single shared axis) |
| Line and clustered column chart | `lineClusteredColumn` / `combo` (single shared axis) |
| Waterfall chart | `waterfall` |
| Funnel | `funnel` |
| Scatter chart | `scatter` / `bubble` |
| Pie chart | `pie` (drill-down: `drillPie`) |
| Donut chart | `donut` (drill-down: `drillDonut`) |
| Treemap | `treemap` |
| Gauge | `gauge` |
| Card | `card` |
| Multi-row card | `multiRowCard` |
| KPI | `kpi` |
| Table | `table` |
| Matrix | `matrix` (data bars: `dataBars`; colour scale: use a `heatmap` visual) |
| Decomposition tree | `decompositionTree` |
| Text box / Smart narrative | `text` with `{{agg:field}}` tokens |
| Sankey (AppSource) | `sankey` |
| Sunburst (AppSource) | `sunburst` |
| Ribbon chart, Map, Filled map, Azure map, Shape map, Key influencers, Q&A, Paginated report | Not yet — see [ROADMAP.md](../ROADMAP.md) |

## A porting recipe

1. Export each page's underlying data (*Export data → Summarized* or the source query) to CSV.
2. `node scripts/csv-to-data.mjs page.csv mydata dashboards/mydata.js`.
3. For each Power BI visual, add one Atlas visual using the table above, mapping its wells to keys.
4. Re-create slicers as `filters`, page navigation as `nav`, drill-through pages as `drillThrough` targets.
5. `npm run validate`.

The prompt in [`prompts/port-powerbi-report.md`](../prompts/port-powerbi-report.md) walks an AI assistant through
the same steps from a screenshot or a description of the report.
