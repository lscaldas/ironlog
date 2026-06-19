# IronLog Full Fix Report

Date: 2026-06-19

## Bugs fixed

1. P1 import validation
   - Added strict JSON backup validation before replacing `DB`.
   - Rejects invalid top-level structures, invalid or future dates/timestamps, decimal/non-integer reps, invalid weights, duplicate ids, bad set exercise references, and bad workout set references.
   - Preserves current visible/local data when import validation fails.
   - Keeps valid backup migration path by still passing accepted imports through `normalizeDB()`.

2. P2 logged-set editing
   - Added an accessible `Edit set` button to each visible logged set chip.
   - Reuses the existing set sheet in edit mode with the same reps/weight validation as new logging.
   - Updates the existing set in place so workout/history references keep the same set id.

3. P2 mobile toast overlap
   - Moves visible toasts to the top of the viewport while any bottom sheet is open.
   - Keeps the primary `Log this set` action visible and unobscured on a 390 x 844 mobile viewport.

4. Static app cache update
   - Bumped the service-worker cache name so changed app shell assets are refreshed for existing users.

## Production files changed

- `index.html`
  - Import validator and guarded import handler.
  - Logged-set edit controls and update flow.
  - Shared set-input validation refactor.
  - Sheet-open toast positioning.

- `sw.js`
  - Cache version bumped from `ironlog-static-v18` to `ironlog-static-v19`.

## Test results before and after

Before, from `TEST_BASELINE_FULL.md`:

- `npm test`
- 21 total, 18 passed, 3 failed, 0 skipped, 0 flaky.
- Failed: `MF-07 logged sets expose an edit flow that persists changed values`.
- Failed: `invalid structured import is rejected and preserves current visible data`.
- Failed: `mobile logging sheet keeps primary action visible and unobscured by toast`.

After targeted fixes:

- `npx playwright test tests/full/ironlog.full.spec.js -g "MF-07"`: 1 passed.
- `npx playwright test tests/full/ironlog.full.spec.js -g "invalid structured import"`: 1 passed.
- `npx playwright test tests/full/ironlog.full.spec.js -g "mobile logging sheet"`: 1 passed.
- `npx playwright test -g "T-014|T-015|T-020|SMK-02|SMK-05"`: 5 passed.
- `npx playwright test tests/full/ironlog.full.spec.js -g "offline reload"` after service-worker cache bump: 1 passed.

Final complete suite:

- `npm test`
- 21 passed, 0 failed.

Browser console check:

- Chromium pass through profile open, start workout, log set, edit set.
- No `console.error` messages or page errors observed.

## Remaining failures

None in the automated Playwright suite.

## Test changes and justification

No tests were weakened, skipped, deleted, or modified.

## Remaining manual-only issues

From the full baseline, these remain manual or product-decision areas:

- Multi-tab or multi-window attempts to create simultaneous active workouts for the same profile.
- Browser password-manager warnings around PIN/password fields.
- Large-history import performance and recovery behavior.
- Full PWA install/update/offline lifecycle beyond a service-worker-backed offline reload.
- Product decision checks for no-reload local profile switching.
- Product decision checks for direct set deletion confirmation/undo.
- Product decision checks for completed-workout editing.
