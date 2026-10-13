# Prompt: port a Power BI report page

```
In the Atlas HTML Charts repository, read AGENTS.md, docs/config-reference.md and docs/powerbi-mapping.md.

I'm attaching <a screenshot / a description> of a Power BI report page and the exported data
(<path to CSV>). Rebuild it as an Atlas dashboard.

1. List every visual on the Power BI page: its Power BI type, title, and what is in each well
   (Axis, Legend, Values, Tooltips), plus every slicer and page-level filter.
2. Map each one to an Atlas type and keys using docs/powerbi-mapping.md. Call out anything with no
   equivalent and what you used instead (e.g. dual-axis combo → shared-axis combo, or two charts).
3. Convert the data with scripts/csv-to-data.mjs. If the Power BI page used several tables, say which
   columns need to be joined into one flat table before export.
4. Create dashboards/<slug>.html from templates/dashboard.html, keeping the Power BI layout order
   (top-left to bottom-right) on the 12-column grid.
5. Run `npm run validate`, then report the mapping table and any gaps.
```
