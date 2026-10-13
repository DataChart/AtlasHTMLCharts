# Prompt: create a brand theme

```
In the Atlas HTML Charts repository, read docs/theming.md and atlas/atlas.css (the :root tokens).

Create themes/<brand>.css for <brand name>:
- accent colour: <hex>, header background: <hex or "light">, font: <font stack>, corner radius: <px>.
- Override tokens only; do not restyle components except where docs/theming.md shows header overrides.
- Provide dark-mode values for every colour you change, under both the prefers-color-scheme block and
  :root[data-theme="dark"].
- Do not change --atlas-series-* unless I give you a validated palette; explain why if I ask you to.
Then add the <link> to <dashboard path> after atlas.css and run `npm run validate`.
```
