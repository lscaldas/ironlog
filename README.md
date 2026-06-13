# IronLog

IronLog is a static, single-page workout tracker. It can be hosted on GitHub Pages, Netlify, or Cloudflare Pages with no build step.

## Data model

Workout data is private to each browser/device and is stored in `localStorage` under `ironlog.v2`.

- Adding exercises, sections, and sets does not rewrite `index.html`.
- Each person who opens the hosted URL has their own separate data.
- Use **Data & backup -> Export data (JSON)** to back up or move data.
- Use **Import data (JSON)** to restore a backup on another device or after clearing browser data.

## Deploy Options

Public app files:

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`
- `icons/icon.svg`

Do not publish the spreadsheet or `.transcription_crops/`; they are source artifacts, not app files.

### GitHub Pages

1. Create a GitHub repository.
2. Upload the public app files above to the repository root, or push this folder with Git after `.gitignore` is in place.
3. In GitHub, open **Settings -> Pages**.
4. Set **Source** to deploy from the main branch root.
5. Share the Pages URL.

### Netlify

1. Drag this folder into Netlify Drop, or connect the GitHub repository.
2. Use no build command.
3. Use `/` as the publish directory if Netlify asks.

### Cloudflare Pages

1. Connect the GitHub repository.
2. Set framework preset to **None**.
3. Leave build command empty.
4. Use `/` as the output directory.

## Updating

Edit the files, push or upload the new version, then reload the hosted app. The service worker is network-first for page loads, so online visits should pick up updates while still keeping an offline fallback.
