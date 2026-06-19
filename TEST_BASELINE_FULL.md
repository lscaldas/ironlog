# IronLog Full Test Baseline

Date: 2026-06-18  
Application under test: IronLog static app at `http://127.0.0.1:8123/`  
Runner: Playwright Chromium  
Source of expected behavior: `TEST_PLAN.md`, existing smoke suite, and user-requested full coverage areas.

## Files Added Or Changed

- Added `tests/full/ironlog.full.spec.js` with 15 full-regression tests.
- Updated `playwright.config.js` so the complete suite runs from `tests/`, writes `playwright-results/full-results.json`, and starts the existing static server directly with `node tests/smoke/static-server.cjs`.
- Updated `package.json` scripts:
  - `npm run test:smoke` runs only `tests/smoke`.
  - `npm run test:full` runs all tests.
  - `npm test` runs the complete suite.

No production application file was modified by this full-test pass.

## Requirement Map

| Requirement / scenario area | Already covered | New automated test added | Manual test needed |
| --- | --- | --- | --- |
| Fatal launch | `SMK-00` | None | No |
| Lock screen forward Tab focus | `SMK-01` | Reverse Tab, Escape, Enter, and pointer attempts in `locked screen traps reverse tab...` | Browser password-manager warnings remain manual |
| Start workout / active state / reload | `SMK-01`, `SMK-02` | Empty cancel and cancel-with-sets edge cases | True multi-tab simultaneous active-workout race remains manual |
| Finish workout and completed History session | `SMK-03` | Keyboard disclosure of completed session details | Completed-workout edit workflow remains product-missing/manual |
| Completed-workout deletion | `SMK-04` | None | No |
| Duplicate `Log this set` | `SMK-02` | None | No |
| Duplicate `Log & add another` | None | `T-013 rapid Log and add another...` | No |
| Invalid reps and weights | None | `T-014`, `T-015` | App-defined maximum ranges may need product confirmation |
| Valid numeric persistence | `SMK-02` | Stats/set deletion test also exercises persisted set values | No |
| Exercise editing/deletion | None | `exercise editing and deletion are persisted...` | No |
| Set editing/deletion | Set deletion indirectly through smoke completed-workout deletion | `MF-07 logged sets expose an edit flow...`, `T-020 visible set removal recalculates statistics...` | Confirmation/undo UX for direct set deletion needs product decision |
| Statistics after edits/deletions | Smoke covers completed-workout deletion | `T-020` verifies set removal recalculates Progress after reload | Completed-workout edit statistics remain product-missing/manual |
| Profile isolation | None | `local profile logout keeps profiles isolated...` | No-reload local profile switch remains manual/product-missing |
| Login persistence and logout | Refresh persistence partially covered by `SMK-01` | `login persists across reload, logout relocks...` | No |
| Export, erase, restore | `SMK-05` | Invalid structured import with future/invalid values | Large-history import performance remains manual |
| Invalid import handling | Malformed JSON covered by `SMK-05` | `invalid structured import is rejected...` | No |
| Mobile behavior | None | `mobile logging sheet keeps primary action visible...` | Additional device/browser matrix manual |
| Offline behavior | None | `offline reload keeps the app shell and local workout data available` | Full PWA install/offline lifecycle manual |

## Tests Added

- `T-007 cancel empty active workout returns to idle and persists after reload`
- `T-008 cancelling a workout with sets requires an explicit choice and preserves or deletes accordingly`
- `T-013 rapid Log and add another activation creates one set and leaves the sheet ready`
- `T-014 invalid reps are rejected without creating sets`
- `T-015 invalid weights are rejected without creating sets`
- `T-020 visible set removal recalculates statistics after reload`
- `MF-07 logged sets expose an edit flow that persists changed values`
- `exercise editing and deletion are persisted without erasing logged history`
- `local profile logout keeps profiles isolated and data recoverable`
- `login persists across reload, logout relocks the app, and data survives re-open`
- `invalid structured import is rejected and preserves current visible data`
- `locked screen traps reverse tab, Escape, Enter, and pointer attempts inside the gate`
- `completed history sessions toggle details from the keyboard`
- `mobile logging sheet keeps primary action visible and unobscured by toast`
- `offline reload keeps the app shell and local workout data available`

## Full Run Result

Command:

```powershell
npm test
```

Final summary: 21 total, 18 passed, 3 failed, 0 skipped, 0 flaky.  
Duration: 136.4 seconds.  
JSON result: `C:\Users\Lucas\Documents\Python_Scripts\Workout\playwright-results\full-results.json`  
HTML report: `C:\Users\Lucas\Documents\Python_Scripts\Workout\playwright-report\index.html`

## Passed Tests

| Test | Coverage |
| --- | --- |
| `T-007 cancel empty active workout returns to idle and persists after reload` | Empty active-workout cancellation |
| `T-008 cancelling a workout with sets requires an explicit choice and preserves or deletes accordingly` | Abandoning a workout with logged sets |
| `T-013 rapid Log and add another activation creates one set and leaves the sheet ready` | Duplicate prevention for `Log & add another` |
| `T-014 invalid reps are rejected without creating sets` | Reps validation for `0`, negative, decimal, exponent, blank, excessive |
| `T-015 invalid weights are rejected without creating sets` | Weight validation for negative, exponent, too many decimals, excessive |
| `T-020 visible set removal recalculates statistics after reload` | Progress/statistics recalc after direct set removal |
| `exercise editing and deletion are persisted without erasing logged history` | Exercise edit/delete persistence |
| `local profile logout keeps profiles isolated and data recoverable` | Profile isolation through logout/re-open |
| `login persists across reload, logout relocks the app, and data survives re-open` | Login persistence and logout |
| `locked screen traps reverse tab, Escape, Enter, and pointer attempts inside the gate` | Additional keyboard lock behavior |
| `completed history sessions toggle details from the keyboard` | Keyboard accessibility for completed session disclosure |
| `offline reload keeps the app shell and local workout data available` | Offline cached app shell and persisted local data |
| `SMK-00 app opens without a fatal error` | Smoke launch |
| `SMK-01 new user setup, refresh auth, locked focus, and start lifecycle` | Smoke auth/focus/start lifecycle |
| `SMK-02 log a set, block duplicate submission, and persist after reload` | Smoke set logging and duplicate `Log this set` |
| `SMK-03 finish workout once and show exactly one completed history entry after reload` | Smoke completion/history |
| `SMK-04 delete completed workout and keep it deleted after reload` | Smoke completed-workout deletion |
| `SMK-05 export, erase, and restore through visible controls` | Smoke backup restore |

## Failed Tests

### `MF-07 logged sets expose an edit flow that persists changed values`

Observed behavior: after logging a visible set, no accessible button named like `edit set`, `edit logged set`, or `modify set` existed. The visible set chip could be removed, but no edit flow was available to change reps or weight and save the updated values.

Failure type: Application failure.  
Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\full-ironlog.full-MF-07-lo-91087-hat-persists-changed-values-chromium\test-failed-1.png`  
Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\full-ironlog.full-MF-07-lo-91087-hat-persists-changed-values-chromium\trace.zip`

### `invalid structured import is rejected and preserves current visible data`

Observed behavior: importing a JSON backup with `exercises: "not an array"`, a future-dated set, decimal reps, negative weight, and a completed workout referencing that bad set showed `Imported ✓` instead of an invalid/future-data error. The test expected the existing visible data to be preserved.

Failure type: Application failure.  
Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\full-ironlog.full-invalid--97e37-serves-current-visible-data-chromium\test-failed-1.png`  
Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\full-ironlog.full-invalid--97e37-serves-current-visible-data-chromium\trace.zip`

### `mobile logging sheet keeps primary action visible and unobscured by toast`

Observed behavior: on a 390 x 844 viewport, opening the log sheet immediately after profile open left a visible toast overlapping the `Log this set` primary action. The bounding boxes intersected, so the test reported `Received: true` for overlap.

Failure type: Application failure.  
Screenshot: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\full-ironlog.full-mobile-l-9c680-ble-and-unobscured-by-toast-chromium\test-failed-1.png`  
Trace: `C:\Users\Lucas\Documents\Python_Scripts\Workout\test-results\full-ironlog.full-mobile-l-9c680-ble-and-unobscured-by-toast-chromium\trace.zip`

## Infrastructure Failures

Resolved before final baseline:

- An initial `npm test` command timed out at the shell-command ceiling before returning results; rerunning with a longer command timeout allowed Playwright to complete.
- The first complete Playwright run failed all 21 tests with `ERR_CONNECTION_REFUSED` at `http://127.0.0.1:8123/`. The app server itself worked when started as `node tests/smoke/static-server.cjs`, while the Playwright `webServer.command` wrapper `npm run start:smoke` was brittle in this Windows process-spawn context. `playwright.config.js` now starts the same server directly with Node.
- Three test-side assertion issues were corrected before the final run: a strict `getByText` selector in the exercise-edit test, an internal `aria-hidden` assertion in the logout test, and a hidden `Open IronLog` heading match in the offline test.

Final run infrastructure failures: none.

## Manual-Only Coverage

- Multi-tab or multi-window attempts to create simultaneous active workouts for the same profile.
- Browser password-manager warnings around PIN/password fields.
- Large-history import performance and recovery behavior.
- Full PWA install/update/offline lifecycle beyond a service-worker-backed offline reload.
- Product decision checks for no-reload local profile switching, direct set deletion confirmation/undo, and completed-workout editing because those controls are not clearly exposed as implemented user flows.

## Prioritized Application Bugs Discovered

| Priority | Area | Bug |
| --- | --- | --- |
| P1 | Import validation | Invalid structured backups can be accepted with `Imported ✓`, including non-array `exercises`, future-dated workout data, decimal reps, and negative weight. This can replace or corrupt current visible data instead of preserving it. |
| P2 | Set editing | Logged sets have no accessible edit flow, so users cannot correct reps or weight after saving a set. |
| P2 | Mobile logging | Mobile toast placement can overlap the primary `Log this set` action on a 390 x 844 viewport. |

