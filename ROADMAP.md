# Roadmap

Ideas and planned work, roughly in priority order. Contributions welcome — open an issue first for anything large.

## Next
- **More business templates**: finance P&L, order-to-cash, inventory, HR / recruiting funnel, project portfolio,
  IT service desk — each a ready page + sample data + brief.
- **Map visuals**: filled (choropleth) and point maps with bundled world / country GeoJSON.
- **Ribbon chart** (Power BI rank-over-time).
- **Shareable state**: write slicer selections to the URL so a filtered view can be bookmarked.
- **Cascading slicers**: options in one slicer narrowed by the others.

## Later
- Multiple data sets per page with simple joins on a key.
- Conditional formatting rules for tables and matrices (colour scales, icons, thresholds).
- Small-multiples layout for any category chart.
- Reference lines / target bands on line and bar charts.
- Optional `fetch()` data loading from a URL (APIs, served CSV) with refresh interval.
- Export the whole page to PNG / PowerPoint.
- Localised UI strings.

## Done (0.1)
- Page template: logo, nav, upload, download, print, theme toggle
- Slicers: dropdown, list, buttons, date range, numeric range, search
- 30+ visual types incl. the Power BI core set, Sankey, drill-down / drill-through pies, decomposition tree
- Cross-filtering, drill-through pages, URL filters
- JSON Schema, validator, Playwright tests, AGENTS.md and prompt library
