# Getting started

You need a browser. That's it. Node.js is only needed to run the validator and tests.

## 1. Look around

Open these files directly in your browser (double-click works):

- `gallery/index.html` — every visual and every filter type
- `examples/sales/index.html` — a four-page sales dashboard with drill-through
- `templates/dashboard.html` — the starter page you will copy

## 2. Make your own

```bash
cp templates/dashboard.html dashboards/operations.html
```

Open `dashboards/operations.html` in an editor. There are only two things to change.

**The data.** The copy opens straight away with the bundled starter data. Replace
`<script src="../templates/starter-data.js">` with your own data file (see [data.md](data.md)):

```html
<script src="operations-data.js"></script>
```

where `operations-data.js` contains

```js
Atlas.registerData("operations", [
  { "date": "2025-01-03", "site": "Leeds", "line": "A", "units": 1200, "defects": 14 },
  ...
]);
```

**The config.** Edit the JSON block: set `"data": "operations"`, the `title`, your `logo`, the `nav` links,
and the `filters` and `visuals` you want. Start by copying blocks from the gallery page.

Refresh the browser. If a visual names a field that isn't in your data, it shows an error card listing the
fields that are available.

## 3. Your logo

Drop your logo file anywhere (for example `assets/my-company.svg`) and point to it:

```json
"logo": "../assets/my-company.svg"
```

SVG and PNG both work; it is shown 32px high (change `--atlas-logo-height` in a theme to adjust).

## 4. Check it

```bash
npm install
npm run validate
```

The validator checks the JSON against the schema, and that every file the page references exists.

## 5. Share it

A dashboard is a folder of static files. Zip it, put it on a file share, SharePoint, an S3 bucket,
GitHub Pages or any web server. Data lives in the data file, so updating the dashboard means replacing that file.
Viewers can also load a fresh CSV with the **Upload** button without touching any file.
