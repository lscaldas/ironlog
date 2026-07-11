# IronLog — project instructions

- Do NOT use the superpowers plugin skills (brainstorming, writing-plans, TDD gates, etc.) in this repo. Work directly: read code, implement, verify with the Playwright suite and browser.
- Vanilla JS PWA, no build step (GitHub Pages, branch-root deploy). Keep everything in plain `js/` modules loaded by `index.html`.
- Core product idea: weekly muscle-group set bars drive exercise choice. Each muscle bar fills through three stacked tiers (maintain → build → beast, thresholds in `REC_SETS_TIERS`), video-game style. Per-exercise set targets are NOT a mechanic; effective-set contributions (primary + secondary muscles) are what count.
