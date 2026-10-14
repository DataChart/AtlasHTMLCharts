# Prompt: review a dashboard

```
Review <path/to/dashboard.html> against AGENTS.md and docs/config-reference.md. Do not edit anything yet.

Report, most important first:
1. Questions the page claims to answer but doesn't (or answers with the wrong visual type).
2. Layout: rows that don't add up to 12 columns, the headline number not top-left, unrelated visuals adjacent.
3. Measures without a format or label; wrong aggregation (e.g. summing a rate or a percentage).
4. Filters missing for the main dimensions, or filters nobody needs.
5. Pages in the same set with inconsistent nav, logo or field labels.
6. Anything `npm run validate` reports.
Finish with a proposed edited config block.
```
