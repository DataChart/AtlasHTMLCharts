# Contributing

Thanks for helping. A few principles keep Atlas easy to use and easy for AI assistants to drive:

1. **No build step.** `atlas/*.js` is plain browser JavaScript that runs from `file://`. No modules, bundlers or
   runtime dependencies beyond the vendored ECharts.
2. **Config over code.** New capabilities are exposed as documented config keys, not as instructions to write
   JavaScript in a page.
3. **Schema, docs, gallery and runtime stay in sync.** `npm run validate` checks that every registered visual type
   is in the schema and documented; the browser tests check that the gallery shows every type.
4. **Accessible by default.** Charts keep their data-table view, colour is never the only signal, and both themes work.

## Setup

```bash
npm install
npm test
```

Tests run in Chromium, Firefox and WebKit (Safari's engine) via Playwright, because viewers open dashboards in
whatever browser they have. Install the engines once with `npx playwright install`. To run a single engine, use
`npm run test:chromium` or `npx playwright test --project=webkit`; set `PW_CHROMIUM_PATH` to use an existing Chromium binary.
CI runs all three on every pull request.

## Pull requests

- One topic per PR; include a gallery example for new visuals and a test for new behaviour.
- Regenerate sample data with `npm run data` and screenshots with `node scripts/screenshots.mjs` if you change them.
- Keep the README's feature list and `ROADMAP.md` current, and add a line to `CHANGELOG.md` under "Unreleased".
