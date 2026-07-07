# IronLog

IronLog is a static, single-page workout tracker. It can be hosted on GitHub Pages, Netlify, or Cloudflare Pages with no build step.

Product plans (accounts, billing, sync rework, build tooling) are tracked in [docs/ROADMAP.md](docs/ROADMAP.md).

## Data model

Workout data is private to each browser/device and is stored in `localStorage` under `ironlog.v2`.

- Adding exercises, sections, and sets does not rewrite `index.html`.
- Each person who opens the hosted URL has their own separate data.
- Use **Data & backup -> Export data (JSON)** to back up or move data.
- Use **Import data (JSON)** to restore a backup on another device or after clearing browser data.

## Deploy Options

Public app files:

- `index.html`
- `styles.css`
- `js/` (app scripts, loaded in order — plain scripts sharing global scope, no build step)
- `cloud-config.js`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`
- `icons/icon.svg`
- `supabase.sql`

Do not publish the spreadsheet or `.transcription_crops/`; they are source artifacts, not app files.

## Optional Cloud Sync

Cloud sync uses Supabase as a tiny encrypted backup store. The app still works offline and saves locally first.

Each profile uses a profile name and PIN. New profile names are created on first cloud save. The PIN is not sent to Supabase; it derives an AES-GCM encryption key in the browser. Supabase stores only encrypted JSON blobs.

This is casual privacy, not full account security. Anyone with the public app configuration could overwrite encrypted blobs if they know the profile IDs. They still cannot read the workout data without the PIN.

### Supabase Setup

1. Create a free Supabase project.
2. Open **SQL Editor**.
3. Run the SQL in `supabase.sql`.
4. Open **Project Settings -> API**.
5. Copy the project URL and anon public/publishable key.
6. Put them into `cloud-config.js`:

```js
window.IRONLOG_CLOUD = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_OR_PUBLISHABLE_PUBLIC_KEY"
};
```

7. Commit and push the update.

In the app, enter a profile name and PIN on the first screen. If the encrypted cloud profile already exists, it loads. If it does not exist, the app creates it from the current local program. After a profile is unlocked, normal changes auto-save encrypted to cloud.

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
