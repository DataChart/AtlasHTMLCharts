# Prompt: create a new dashboard

```
You are working in the Atlas HTML Charts repository. Read AGENTS.md and docs/config-reference.md first.

Build a new dashboard following the brief below.

Steps:
1. Inspect the data file(s): list every column with its inferred type (number / ISO date / text), the row
   count and 3 sample rows. If the data is a CSV, convert it with
   `node scripts/csv-to-data.mjs <csv> <dataset-name> dashboards/<dataset-name>.js`.
2. Propose the page layout as a short list: for each row of the 12-column grid, the visuals, their type and
   span, and the question each one answers. Use the "Choosing a visual" table in AGENTS.md. Then build it
   without waiting for confirmation unless the brief is ambiguous about the measures.
3. Copy templates/dashboard.html to dashboards/<slug>.html. Change only: <title>, the data <script src>,
   the optional theme <link>, and the JSON config block.
4. In the config: set fields (label + format for every measure), filters (date range first), nav (same on
   every page), and visuals. Use field names exactly as in the data. Do not invent config keys.
5. Run `npm run validate` and fix every reported problem.
6. Reply with: the files you created, the layout list, and anything in the brief you could not express
   with the available visuals.

Brief:
<paste prompts/dashboard-brief.md, filled in>
```
