# Prompt library

Copy-paste prompts for working on dashboards with an AI assistant (Claude, ChatGPT, Copilot Chat, Cursor…).
They assume the assistant can read this repository; if it can't, paste `AGENTS.md`, `docs/config-reference.md`
and the relevant page into the chat first.

| Prompt | Use it to |
|---|---|
| [dashboard-brief.md](dashboard-brief.md) | Write down what a dashboard is for — fill this in first, then hand it to any prompt below |
| [new-dashboard.md](new-dashboard.md) | Create a new dashboard from a data file and a brief |
| [add-visual.md](add-visual.md) | Add or change a visual on an existing page |
| [port-powerbi-report.md](port-powerbi-report.md) | Rebuild a Power BI report page from a screenshot or description |
| [restyle.md](restyle.md) | Create a brand theme |
| [review-dashboard.md](review-dashboard.md) | Get a critique of an existing page against the conventions |
| [new-visual-type.md](new-visual-type.md) | Add a new visual type to the framework |

Why prompts are kept in the repo: the same prompt + the same templates + a validated schema gives the same
kind of dashboard every time, whoever (or whatever) is doing the typing.
