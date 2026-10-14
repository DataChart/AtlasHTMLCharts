# Extending Atlas

## Add a visual type

Visuals live in `atlas/visuals.js`. Each one is a function that receives a **context** (`ctx`) and draws into
`ctx.el`. Register it with a type name:

```js
Atlas.registerVisual('bullet', function (ctx) {
  var m = ctx.measures()[0];                       // normalised measure from "value"
  var value = ctx.aggregate(ctx.rows, m);          // rows are already filtered
  var target = ctx.config.target;
  ctx.chart({                                      // ECharts option; theme defaults are merged in
    grid: { left: 8, right: 8, top: 8, bottom: 8 },
    xAxis: ctx.valueAxis(m.format), yAxis: { type: 'category', data: [m.label], show: false },
    series: [{ type: 'bar', data: [value], barWidth: 16, itemStyle: { color: ctx.theme.palette[0] },
               markLine: { symbol: 'none', data: [{ xAxis: target }], lineStyle: { color: ctx.theme.ink } } }]
  }, { height: 80 });
  ctx.setTable([{ key: 'm', label: 'Measure' }, { key: 'v', label: 'Value', format: m.format, numeric: true }],
               [{ m: m.label, v: value }, { m: 'Target', v: target }]);
}, { chart: true, span: 4 });
```

`meta.chart: true` adds the data-table and PNG buttons. `meta.span` is the default width.

You can register a visual from a separate `<script>` loaded after `visuals.js` for one dashboard, but for anything
reusable add it to `atlas/visuals.js` and then:

1. add the type to `$defs.visual.properties.type.enum` in `schema/dashboard.schema.json` (and any new keys to `properties`);
2. document it in `docs/config-reference.md`;
3. add an example to `gallery/index.html`;
4. run `npm test` — the validator and the gallery test fail until all three agree.

## The context API

| Member | What it gives you |
|---|---|
| `ctx.config` | This visual's config object |
| `ctx.rows` / `ctx.allRows` | Filtered rows / every row |
| `ctx.el` | The element to draw into |
| `ctx.theme` | Live colour tokens: `palette[8]`, `ink`, `ink2`, `muted`, `grid`, `axis`, `surface`, `accent`, `seqLow/Mid/High`, status colours |
| `ctx.measure(spec)` / `ctx.measures(key?)` | Normalise `"field"` or `{field, agg, label, format}` |
| `ctx.aggregate(rows, measure)` | Apply the measure's aggregation |
| `ctx.dimension(field, grain?)` | `{ key(row), label(key), meta, grain }` — date fields are bucketed by grain |
| `ctx.categorize(opts)` | Group by `category` (+ `series`), aggregate, sort, fold the tail into "Other" |
| `ctx.hierarchy(levels, measure)` | Nested `{name, value, children}` for tree visuals |
| `ctx.colorFor(field, value)` | Stable colour for an entity |
| `ctx.chart(option, {height})` | Create/update the ECharts instance (base styling merged in); returns it for `.on('click')` |
| `ctx.categoryAxis(labels)`, `ctx.valueAxis(format)`, `ctx.legend(show)` | Pre-styled axis and legend options |
| `ctx.select(field, key, grain?)` | Cross-filter or drill-through on click |
| `ctx.isDimmed(field, key)` | Whether a mark should be dimmed by the current selection |
| `ctx.setTable(columns, rows)` | Data for the table view and CSV download |
| `ctx.state` | Per-visual state that survives re-renders (drill path, sort) |
| `ctx.fmt(value, format)` | Format a number/date |
| `ctx.empty(message?)` | Render an empty state |
| `ctx.rerender()` | Re-draw this visual |

## Add a format

```js
Atlas.registerFormat('hours', function (v) { return v.toFixed(1) + ' h'; });
```

## Use Atlas from JavaScript

The JSON block is optional. `Atlas.dashboard(config, mountElement)` returns the dashboard; useful methods:
`setData(rows)`, `refresh()`, `setCrossFilter(field, value)`, `print()`, `toggleTheme()`.
