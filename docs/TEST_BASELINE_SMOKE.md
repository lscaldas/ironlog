# Smoke Test Baseline

Date: 2026-06-18  
Application under test: IronLog static app at `http://127.0.0.1:8123/`  
Runner: Playwright Chromium  
Source of expected behavior: `TEST_PLAN.md` and `QA_AUDIT.md`

## Commands Used

```powershell
npm init -y
npm install --save-dev @playwright/test
npx playwright install chromium
npm run test:smoke
```

The Playwright web server starts the app with:

```powershell
npm run start:smoke
```

which runs:

```powershell
node tests/smoke/static-server.cjs
```

## Test Files Created

- `package.json`
- `package-lock.json`
- `playwright.config.js`
- `tests/smoke/static-server.cjs`
- `tests/smoke/ironlog.smoke.spec.js`

No production application files were modified. `QA_AUDIT.md` and `TEST_PLAN.md` were not modified.

## Full Run Result

Command:

```powershell
npm run test:smoke
```

Summary: 6 total, 1 passed, 5 failed.

JSON result: `C:\Users\Lucas\Documents\Python_Scripts\Workout\playwright-results\smoke-results.json`  
HTML report: `C:\Users\Lucas\Documents\Python_Scripts\Workout\playwright-report\index.html`

## Results By Test

| Test | Status | Relevant QA / acceptance criteria | Exact observed result | Failure type | Artifacts |
| --- | --- | --- | --- | --- | --- |
| SMK-00 app opens without a fatal error | Passed | Smoke item 1 | `Open IronLog` and `IronLog` rendered; no uncaught `pageerror` events. | None | None |
| SMK-01 new user setup, refresh auth, locked focus, and start lifecycle | Failed | QA-008, QA-001; AC-B005-1, AC-B005-2, AC-B001-1, AC-B001-2, AC-B001-3 | Setup completed with `Use local only`, but locked Tab focus escaped to `lucas`, `⋯`, `Maintaining`, and `Building`. Idle Week had no `Start workout`; `Finish today's workout` was visible before any active workout. After refresh, `Open IronLog` was visible again instead of remaining logged in. | Application failure | Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-01-new-u-86d3d-d-focus-and-start-lifecycle-chromium\test-failed-1.png`; Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-01-new-u-86d3d-d-focus-and-start-lifecycle-chromium\trace.zip` |
| SMK-02 log a set, block duplicate submission, and persist after reload | Failed | QA-001, QA-004; AC-B001-2, AC-B001-3, AC-B003-1, AC-B003-3; smoke items 3, 4, 5, 11 | No `Start workout` control existed. Double-clicking `Log this set` produced 2 visible set chips where 1 was expected. No active workout state, active set count, `Finish workout`, or `Cancel workout` appeared. After reload, `Open IronLog` was visible and the duplicate 2-set state persisted. | Application failure | Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-02-log-a-ac757-on-and-persist-after-reload-chromium\test-failed-1.png`; Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-02-log-a-ac757-on-and-persist-after-reload-chromium\trace.zip` |
| SMK-03 finish workout once and show exactly one completed history entry after reload | Failed | QA-001, QA-002, QA-009; AC-B001-4, AC-B001-5, AC-B002-1, AC-B002-2; smoke items 6, 7, 8 | `Finish workout` was not found; only the current app's alternate finish control was usable. The finish review did not expose `Save completed workout`. History exposed 0 accessible completed workout/session rows where exactly 1 was expected, both before and after reload. | Application failure | Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-03-finis-36734--history-entry-after-reload-chromium\test-failed-1.png`; Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-03-finis-36734--history-entry-after-reload-chromium\trace.zip` |
| SMK-04 delete completed workout and keep it deleted after reload | Failed | QA-003, QA-005; MF-06, MF-08; smoke items 9, 10 | The finish flow again lacked `Finish workout` and `Save completed workout`. No completed workout/session row existed before deletion, and no `Delete` button for a completed History entry was found. | Application failure | Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-04-delet-94dc7-eep-it-deleted-after-reload-chromium\test-failed-1.png`; Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-04-delet-94dc7-eep-it-deleted-after-reload-chromium\trace.zip` |
| SMK-05 export, erase, and restore through visible controls | Failed | QA-011; AC-B006-1, AC-B006-2, AC-B006-3 | Export succeeded and invalid import produced an error. After erase, the test attempted to restore through the visible `Import data (JSON)` control, but Playwright could not click it because the resolved button was outside the viewport; no file chooser opened before timeout. | Application failure | Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-05-expor-ed185-re-through-visible-controls-chromium\test-failed-1.png`; Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-05-expor-ed185-re-through-visible-controls-chromium\trace.zip`; Export fixture: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-05-expor-ed185-re-through-visible-controls-chromium\ironlog-export.json`; Invalid fixture: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\ironlog.smoke-SMK-05-expor-ed185-re-through-visible-controls-chromium\invalid-import.json` |

## Infrastructure Blockers

None in the final run. Earlier selector issues were corrected before this baseline:

- The gate profile input shares a placeholder with the backup profile input, so the test now scopes that selector to `#profileGate`.
- The exercise log control exposes a `title` but not a reliable role name, so the test uses `button[title="Log set"]`.
- History navigation is scoped to the bottom `nav` to avoid offscreen backup-sheet text containing `history`.

The SMK-05 file chooser timeout is classified as an application failure because the click log shows the visible `Import data (JSON)` control resolved but stayed outside the viewport.

## Bugs Successfully Caught

- QA-008: keyboard focus leaks behind the lock screen.
- QA-001 / MF-01 / MF-02: no `Start workout`, no visible active workout state, no active set count, no `Cancel workout`.
- Refresh-auth smoke item 11: a previously opened local profile returns to `Open IronLog` after normal reload.
- QA-004: double-clicking `Log this set` creates duplicate sets.
- QA-002: finish flow labels do not match the expected `Finish workout` and `Save completed workout`.
- QA-001 / QA-009: History does not expose a completed workout as an accessible session row and does not retain exactly one completed session after reload.
- QA-003 / MF-06: no completed-workout `Delete` action is available in History.
- QA-011: restore through the visible import control fails after erase because the import button becomes unreachable/outside the viewport.
