# Prompt: add a visual type to the framework

```
In the Atlas HTML Charts repository, read AGENTS.md and docs/extending.md.

Add a new visual type "<name>" that <what it shows and which config keys it takes>.

1. Implement it in atlas/visuals.js with Atlas.registerVisual, using the ctx helpers (categorize, hierarchy,
   chart, valueAxis, setTable, select) so it inherits theming, cross-filtering, the data-table view and CSV export.
   Keep to the browser-only ES5 style of the file (no modules, no build).
2. Add the type and any new keys to schema/dashboard.schema.json.
3. Document it in docs/config-reference.md (catalogue table + a JSON example).
4. Add an example to gallery/index.html.
5. Run `npm test` and fix anything that fails.
```
