# Theming

All colours, radii, spacing and fonts are CSS custom properties ("tokens") defined at the top of
`atlas/atlas.css`. A theme is a small CSS file that overrides some of them. Load it **after** `atlas.css`:

```html
<link rel="stylesheet" href="../atlas/atlas.css">
<link rel="stylesheet" href="../themes/midnight.css">
```

Two examples ship in `themes/`: `midnight.css` (dark header bar) and `evergreen.css` (warm page, green accent).

## Tokens you will usually change

| Token | Purpose |
|---|---|
| `--atlas-accent` | Buttons, active nav underline, selected tiles, focus rings |
| `--atlas-header-bg`, `--atlas-header-ink` | Header bar colours |
| `--atlas-page`, `--atlas-surface` | Page background, card background |
| `--atlas-font` | Font stack |
| `--atlas-radius`, `--atlas-radius-sm` | Card and control corner radius |
| `--atlas-logo-height` | Logo height (default 32px) |
| `--atlas-chart-height` | Default chart height (default 320px) |
| `--atlas-max-width` | Page width cap (default 1600px) |

Charts read the tokens live, so a theme recolours ECharts too, including when the viewer toggles dark mode.

## Dark mode

Every token has a dark value, applied when the OS prefers dark or when the viewer clicks the theme button
(`<html data-theme="dark">`). If your theme changes a colour, give it a dark value too, under both selectors:

```css
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) { --atlas-accent: #2fa874; }
}
:root[data-theme="dark"] { --atlas-accent: #2fa874; }
```

## Series colours

`--atlas-series-1` … `--atlas-series-8` are the categorical palette. The default order was validated for
colour-vision deficiency (adjacent colours stay distinguishable for the common forms of colour blindness) in both
light and dark mode. If your brand requires different series colours:

- keep exactly 8, in a fixed order, with a light and a dark value each;
- check adjacent pairs with a colour-blindness simulator before shipping;
- keep status colours (`--atlas-good`, `--atlas-warning`, `--atlas-serious`, `--atlas-critical`) distinct from series colours.

## Print

Printing hides navigation, buttons and slicer controls, prints the active filters at the top, and avoids splitting a
visual across pages. Use the browser's *Save as PDF* for a PDF.
