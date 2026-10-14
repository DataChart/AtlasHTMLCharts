# Your dashboards

Put your own dashboard pages here. Start from the template:

```bash
cp templates/dashboard.html dashboards/my-dashboard.html
```

Then change the data `<script>` and the JSON config block. Pages in this folder can use the same relative
paths as the template (`../atlas/...`, `../vendor/...`, `../assets/...`), so they work without changes.
Keep data files next to the page (e.g. `dashboards/my-data.js`) or in a sub-folder.
