# Smoke Fix Report

Date: 2026-06-18

## Production Files Changed

- `index.html`
- `sw.js`

## Implementation Summary

- Added a persistent local session marker in `localStorage` that stores only profile name, auth mode, issue time, and expiry. Normal refresh/reopen preserves a valid session. Explicit `Log out` clears only the session marker and leaves profile data intact.
- Added safe locked-state behavior: while the open-profile gate is visible, the app shell and nav are inert, hidden from assistive tech, and Tab/Shift+Tab cycle only through gate controls.
- Added a formal workout lifecycle:
  - `Start workout` creates one active workout.
  - Active state shows start time and set count.
  - `Finish workout` opens review.
  - `Save completed workout` persists one completed workout and clears active state.
  - `Cancel workout` discards an empty workout, or requires confirmation before deleting logged active-workout sets.
- Attached newly logged sets to the active workout via `workoutId` and active `setIds`.
- Added duplicate-action protection for set logging and workout completion.
- Reworked History to list completed workouts as accessible session rows with visible `Delete`.
- Added confirmed completed-workout deletion that removes the workout and its related sets, so Week/History/Progress recalculate from remaining data.
- Preserved legacy raw sets as legacy history groups instead of silently converting them into completed workouts.
- Kept the Data & backup sheet open after erase and scrolled the visible Import button into reach.
- Marked closed sheets inert/ARIA-hidden so hidden off-canvas controls do not pollute role-based interaction.
- Bumped the service-worker cache name from `ironlog-static-v17` to `ironlog-static-v18`.

## Data Model / Storage Migration

- Profile data now normalizes to `schemaVersion: 3`.
- Added `initialized`, `workouts`, and `activeWorkout` fields.
- Existing `exercises` and `sets` are preserved.
- Existing sets receive missing `id`, `date`, `ts`, numeric `reps`, and numeric `kg` values when needed.
- New sets are stored with `workoutId`.
- Completed workouts store `{ id, status, startedAt, endedAt, date, setIds }`.
- Legacy sets without a completed workout remain exportable and visible as legacy history; they are not misrepresented as completed sessions.

## Tests Before

Command:

```powershell
npm run test:smoke
```

Baseline before production changes:

- 6 total
- 1 passed
- 5 failed

Failures matched `TEST_BASELINE_SMOKE.md`: SMK-01 through SMK-05.

## Tests During Fix

Targeted runs after related changes:

- `npx playwright test tests/smoke/ironlog.smoke.spec.js -g "SMK-01"`: passed
- `npx playwright test tests/smoke/ironlog.smoke.spec.js -g "SMK-02"`: passed
- `npx playwright test tests/smoke/ironlog.smoke.spec.js -g "SMK-03"`: failed once because closed sheets were still accessible; fixed with inert/ARIA-hidden sheet state
- `npx playwright test tests/smoke/ironlog.smoke.spec.js -g "SMK-03"`: passed
- `npx playwright test tests/smoke/ironlog.smoke.spec.js -g "SMK-04"`: passed
- `npx playwright test tests/smoke/ironlog.smoke.spec.js -g "SMK-05"`: passed

## Tests After

Final command:

```powershell
npm run test:smoke
```

Final result:

- 6 total
- 6 passed
- 0 failed
- 0 skipped

Browser console check:

- Opened `http://127.0.0.1:8123/`
- Opened a local profile
- Reloaded
- Captured browser warning/error logs
- Result: no warnings or errors reported

## Remaining Failures

None in the smoke suite.

## Test Files Changed

None.

No Playwright smoke test assertions, selectors, test flow, config, or baseline documentation were changed.

## Known Limitations / Unresolved Product Decisions

- Completed-workout editing is not implemented in this smoke fix; deletion is implemented.
- Legacy raw dated sets remain visible as legacy history rather than being migrated into completed workouts.
- Cloud sessions preserve the local cached profile session without storing PINs; cloud re-auth still requires the user's PIN when loading encrypted remote data.
