# IronLog

IronLog is a static, single-page workout tracker hosted on Firebase Hosting. It saves locally first and can sync with Google sign-in through Cloud Firestore.

Product plans (accounts, billing, sync rework, build tooling) are tracked in [docs/ROADMAP.md](docs/ROADMAP.md).

## Weekly muscle bars

The Week screen is driven by effective-set progress for each muscle, not per-exercise quotas:

- Every logged set adds `1.0` to its primary muscle plus documented fractional contributions to secondary muscles.
- Each muscle bar fills through three stacked thresholds: **Maintain**, **Build**, and **Beast**.
- Exercise cards show exactly what one set contributes to the muscle bars.
- At the start of a week, the user chooses Push, Pull, Legs, and/or Core. Unselected groups leave both the exercise list and the weekly completion goal.

The weekly selection is stored by Monday date, survives reload/export/cloud sync, and carries forward as the next week's default. After a gap of two or more weeks, the next loadout starts fresh. The home page always uses the current local calendar week and refreshes when the week changes. The picker disappears after confirmation and can be reopened with **Change**.

## Workouts and locations

- Choose **Home** or a saved gym before starting. Manage gym names in **Data & backup**.
- Each exercise has an equipment variant and optional **Available at** locations. A new exercise added during a workout defaults to that location; existing exercises remain available everywhere until edited.
- Previous weights are suggested only for the same exercise, equipment variant, and location.
- **Finish workout** saves immediately. Moving away from the app or closing it saves any active workout with logged sets. If an older active workout remains after a crash, the next launch asks for its duration and suggests 60 minutes when enough time has elapsed.
- **Progress** shows weekly effective set volume for Legs, Core, Push, and Pull, plus one selected muscle with Maintain, Build, and Beast threshold lines. Weeks without sets appear as zero.
- Older versions could generate seven weeks of example sets through **Load my program + sample history**. Those sets are excluded from History, muscle bars, and Progress. **Data & backup** offers a selective removal action when it recognizes them; it saves a local recovery copy first. Real logged sets remain untouched.

## Data model

Local profiles are stored in browser `localStorage` under `ironlog.v2.<profile>`. Signed-in data is also cached on the device under a Google-account-specific key and synced to the matching Firebase account.

- Adding exercises, sections, and sets does not rewrite `index.html`.
- Each Google account has separate cloud data. The profile button shows Local, Syncing, Live, Offline, or Sync issue.
- A previously synced Google profile can be opened from its device cache while offline. Sign in again after reconnecting to merge those changes.
- Use **Data & backup -> Export data (JSON)** to back up or move data.
- Use **Import data (JSON) · merge** after signing in to add an old backup to the chosen Google account. Matching record IDs are merged; this does not replace newer workouts.

## Firebase deployment

Public app files:

- `index.html`
- `styles.css`
- `js/` (app scripts, loaded in order — plain scripts sharing global scope, no build step)
- `firebase-config.js`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`
- `icons/icon.svg`
- `firebase.json` and `firestore.rules` for deployment

Do not publish the spreadsheet or `.transcription_crops/`; they are source artifacts, not app files.

The Firebase project and Hosting site are `ironlog-43233`, and Firestore uses the Berlin region. Google is the enabled sign-in provider. Firestore rules allow each authenticated user to access only their own `users/{uid}/ironlog/*` documents. The web configuration contains public identifiers, not a server secret.

Deploy from this branch with `firebase deploy --only firestore:rules,hosting --project ironlog-43233`. Keep the existing GitHub Pages release on `main` available while people export their data.

### Moving from the old app

1. Open the existing GitHub Pages app on a device where your workouts are visible and use **Data & backup → Export data (JSON)**.
2. Open the Firebase-hosted app, sign in with the Google account you want to use, and choose **Import data (JSON) · merge**.
3. Wait until the profile button says **Live**, then verify History and Progress. Keep the JSON file as an independent backup.

The Google account can have a different name or email from the old local profile. JSON import merges by record ID. A backup contains only workouts visible to the old app when exported. Old Supabase cloud data cannot be decrypted without its original PIN, and an old browser/device with no remaining data cannot be recovered by this migration.

## Updating

Edit the files, deploy with the Firebase CLI, then reload the hosted app. The service worker is network-first for page loads, so online visits should pick up updates while still keeping an offline fallback.
