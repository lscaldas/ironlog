# IronLog Test Plan

Source: `QA_AUDIT.md` only.

Constraints followed:
- No application source code was inspected.
- No application files were modified.
- No automated tests were written.
- This plan is black-box and user-observable. Proposed tests must not depend on internal functions, variables, DOM structure, or implementation details.

## Prioritized Confirmed Bugs

| Priority | QA ID | Confirmed bug | Deduplicated user impact |
| --- | --- | --- | --- |
| P0 | QA-001 | No explicit start, active, finish, or completed-workout lifecycle | Users cannot reliably create, resume, complete, or review a formal workout session. |
| P1 | QA-002 | Finish flow uses misleading labels and save feedback | The app says a workout was saved even though no completed workout is visibly persisted. |
| P1 | QA-004 | Rapid set submission creates duplicate sets | A normal double-click or double-tap can corrupt workout data. |
| P1 | QA-008 | Keyboard focus leaks behind the lock screen | Locked users can tab into background app controls before opening a profile. |
| P2 | QA-006 | Numeric validation allows or mis-parses invalid workout values | Decimal reps, exponent notation, negative weight, and extreme values can produce incorrect saved workout data. |
| P2 | QA-011 | Import button can become unreachable after erase | A destructive erase can leave the visible restore path unusable in the same panel. |

## Usability Problems

| QA ID | Usability problem |
| --- | --- |
| QA-003 | Historical workout management is not discoverable because History has no visible edit or delete actions. The functional gap is tracked under missing features. |
| QA-005 | Logged set correction is weak: sets cannot be edited, and set deletion is immediate with no confirmation or undo. |
| QA-007 | First launch pre-fills a local profile and shows app content behind the lock screen before clear user intent. |
| QA-009 | History rows behave like clickable cards instead of conventional accessible buttons or disclosures. |
| QA-010 | Profile switching is hidden and appears to require a reload. |
| QA-013 | Mobile toast placement can cover the primary logging action. |
| QA-014 | PIN/password fields trigger browser form warnings, suggesting weak form semantics. |

## Missing Features

| ID | Missing feature |
| --- | --- |
| MF-01 | Explicit `Start workout` action. |
| MF-02 | Visible active workout state with resume behavior after reload. |
| MF-03 | Prevention of multiple simultaneous active workouts for the same profile. |
| MF-04 | Explicit cancel or abandon flow for active workouts. |
| MF-05 | Persisted completed workout records shown separately from raw dated sets. |
| MF-06 | Edit and delete completed workouts from History. |
| MF-07 | Edit existing logged sets. |
| MF-08 | Predictable statistics recalculation after workout or set edits/deletions. |
| MF-09 | Import validation for lifecycle data, future dates, invalid values, and large histories. |

## Ambiguous Behavior Remaining

| ID | Ambiguous behavior |
| --- | --- |
| A-01 | Whether a "workout" is a formal user-started session or merely all sets logged on a calendar day. This plan assumes a formal session. |
| A-02 | Whether deleting a completed workout should delete its contained sets, archive them, or detach them from statistics. This plan assumes confirmed deletion removes the workout contribution from History and statistics. |
| A-03 | Whether empty weight means bodyweight, 0 kg, or an explicit bodyweight mode. This plan assumes bodyweight must be visible and unambiguous. |
| A-04 | Whether future-dated imports are ever valid. This plan assumes they should be rejected or require an explicit warning/confirmation. |
| A-05 | Whether local-only profile access should require a PIN or intentionally bypass authentication. This plan assumes locked state must still block background interaction. |
| A-06 | Which statistics must update after edits/deletions: week totals, progress charts, exercise totals, personal records, and history summaries should be defined before test automation. |
| A-07 | Whether set and workout deletion should use confirmation, undo, or both. This plan accepts either, as long as data loss is explicit and reversible until confirmed. |

## Expected Workout Lifecycle Behavior

| Lifecycle area | Expected user-facing behavior |
| --- | --- |
| Starting a workout | When no workout is active, the Week screen shows `Start workout`. Activating it shows a visible active workout state with start time or elapsed time, set count, `Finish workout`, and `Cancel workout`. |
| Preventing multiple simultaneous active workouts | Once a workout is active, `Start workout` is hidden, disabled, or replaced by `Resume workout`. Rapid clicks, reloads, and multiple tabs must not create more than one active workout for the same profile. |
| Logging sets | Sets can be logged only into an active workout. If a user tries to log without one, the app prompts to start a workout first. A saved set is visibly attached to the active workout and survives reload. |
| Reloading during a workout | Reloading and reopening the same profile restores the same active workout, set count, logged set details, and available finish/cancel actions. |
| Finishing a workout | `Finish workout` either completes the workout immediately or opens a review sheet whose primary action is clearly labeled `Save completed workout`. Completion shows confirmation only after the completed workout is visible after reload. |
| Avoiding duplicate finishes | Double-clicking, double-tapping, pressing Enter twice, or retrying after reload must leave exactly one completed workout and no duplicate statistics. |
| Cancelling or abandoning a workout | Cancelling an empty workout discards it. Cancelling a workout with sets presents explicit choices, such as keep editing, save incomplete, or delete workout and sets. Logged data must not disappear silently. |
| Displaying the completed workout in history | History lists completed workouts as sessions with date, start/end or duration, exercises, sets, and totals. History must not present uncompleted raw dated sets as completed workouts. |
| Editing a completed workout | A completed History entry can be opened and edited. Changing set values or workout metadata updates History and statistics after save and reload. |
| Deleting a completed workout | A completed History entry can be deleted only after confirmation or via undo. After deletion and reload, it is absent from History and no longer contributes to statistics. |
| Updating statistics after deletion | Week totals, History summaries, and Progress/statistics views recalculate from the remaining user-visible data after workout deletion. No stale counts remain after reload. |

## Acceptance Criteria for Confirmed Bugs

### QA-001 - Workout Lifecycle Is Missing

| AC ID | Acceptance criterion |
| --- | --- |
| AC-B001-1 | With no active workout, the Week screen shows `Start workout` and does not show `Finish workout` as the primary lifecycle action. |
| AC-B001-2 | Starting a workout shows a visible active state with start/elapsed information, set count, `Finish workout`, and `Cancel workout`. |
| AC-B001-3 | Sets logged during an active workout remain visible in that same active workout after page reload. |
| AC-B001-4 | Finishing a workout removes the active state and leaves a completed workout visible after page reload. |
| AC-B001-5 | History displays completed workouts as sessions, not only raw date groupings. |
| AC-B001-6 | Cancelling or abandoning an active workout is explicit and never silently loses logged sets. |

### QA-002 - Finish Flow Is Misleading

| AC ID | Acceptance criterion |
| --- | --- |
| AC-B002-1 | Lifecycle button labels match their action: `Finish workout` completes, or review uses an explicit `Save completed workout` primary action. |
| AC-B002-2 | `Workout saved` or equivalent success feedback appears only after the completed workout is still visible following reload. |
| AC-B002-3 | Repeated finish/save activation creates exactly one completed workout. |

### QA-004 - Duplicate Set Submission

| AC ID | Acceptance criterion |
| --- | --- |
| AC-B003-1 | Rapid repeated activation of `Log this set` creates at most one set. |
| AC-B003-2 | Rapid repeated activation of `Log & add another` creates at most one set for that submission and leaves the sheet ready for the next intentional set. |
| AC-B003-3 | The active submit control gives visible feedback that repeated submission is blocked while saving. |

### QA-006 - Numeric Validation

| AC ID | Acceptance criterion |
| --- | --- |
| AC-B004-1 | Reps accept only positive whole numbers within the app-defined sane range. |
| AC-B004-2 | Weight accepts only finite, non-negative decimal values within the app-defined sane range. |
| AC-B004-3 | Values visible before save match values visible after reload. |
| AC-B004-4 | Invalid numeric submissions keep the sheet open, identify the field and reason, and do not add a set. |

### QA-008 - Lock Screen Focus Leak

| AC ID | Acceptance criterion |
| --- | --- |
| AC-B005-1 | While locked, Tab and Shift+Tab cycle only through lock-screen controls. |
| AC-B005-2 | Background app controls cannot be focused or activated until a profile is opened. |
| AC-B005-3 | Escape behavior is defined and does not activate or expose background app controls. |

### QA-011 - Import Control Unreachable After Erase

| AC ID | Acceptance criterion |
| --- | --- |
| AC-B006-1 | Invalid import shows an error, preserves existing visible data, and leaves backup controls usable. |
| AC-B006-2 | After `Erase all data`, the visible `Import data` control remains reachable and clickable. |
| AC-B006-3 | A user can export, erase, and restore the exported backup through visible UI controls, and restored data remains after reload. |

## Proposed End-to-End Test Scenarios

| Test name | Preconditions | User actions | Expected visible result | Expected persisted result after page reload | Should fail on current app? | QA finding covered |
| --- | --- | --- | --- | --- | --- | --- |
| T-001 Start workout from idle and restore active state | Local profile exists with no active workout. | Open profile. Observe Week. Select `Start workout`. Reload and reopen the same profile. | Before start, `Start workout` is visible and `Finish workout` is not primary. After start, active workout state shows elapsed/start info, set count `0`, `Finish workout`, and `Cancel workout`. | The same active workout is restored with `0` sets and no completed History entry. | Yes | QA-001; AC-B001-1, AC-B001-2, AC-B001-3 |
| T-002 Prevent multiple active workouts | Same profile has one active workout. | Try to start again by rapid clicking, by reloading, and by opening the app in another tab/window for the same profile. | App offers `Resume workout` or keeps the existing active state. No second active workout appears. | After reload, exactly one active workout is visible for the profile. | Yes | QA-001; AC-B001-2 |
| T-003 Quick log requires or creates active workout explicitly | Same profile has no active workout. | Press the first exercise log/add control. Confirm the start prompt if shown, then save one set. | App clearly starts or resumes a workout before saving. Active state is visible and includes the saved set. | Reload restores the active workout with the saved set. | Yes | QA-001; AC-B001-2, AC-B001-3 |
| T-004 Log set during active workout and reload | Active workout is visible. | Open an exercise log sheet. Enter valid reps and weight. Save one set. Reload and reopen profile. | The set appears in the active workout, exercise progress updates, and active set count increments by one. | The same active workout and set are visible after reload; History does not mark it completed yet. | Yes | QA-001; AC-B001-3 |
| T-005 Finish workout through explicit save | Active workout has at least one set. | Select `Finish workout`. Review summary. Select `Save completed workout`. Reload. Open History. | Review CTA is unambiguous. Success feedback appears. Active state is gone. History shows one completed workout with summary. | The completed workout is still visible in History after reload. | Yes | QA-001, QA-002; AC-B001-4, AC-B001-5, AC-B002-1, AC-B002-2 |
| T-006 Duplicate finish is ignored | Finish review is open for an active workout with one set. | Double-click or double-tap `Save completed workout`, or press Enter twice. Open History and Progress. Reload. | Only one completion message appears, or repeated activation is visibly blocked. History and statistics count one completed workout. | After reload, there is still exactly one completed workout and no duplicate stats. | Yes | QA-002; AC-B002-3 |
| T-007 Cancel empty active workout | Active workout exists with zero sets. | Select `Cancel workout`. Confirm discard if prompted. Reload. | App returns to idle Week state with `Start workout`. History has no new workout. | No active or completed workout appears after reload. | Yes | QA-001; AC-B001-6 |
| T-008 Abandon workout with sets requires explicit choice | Active workout has one set. | Select `Cancel workout`. Choose `Keep editing`; reload. Then select `Cancel workout` again and choose confirmed deletion. | First choice keeps active workout and set. Second choice clearly warns before deleting. No data disappears without a user choice. | After keep-editing reload, active workout and set remain. After confirmed deletion reload, the active workout and set contribution are gone. | Yes | QA-001; AC-B001-6 |
| T-009 History shows completed workout as accessible session | At least one completed workout exists. | Open History. Focus the completed workout row. Toggle details with keyboard and pointer. | Row is a visible button/disclosure with completed-workout summary, expanded/collapsed state, and set details. | Reload keeps the same completed workout available in History. | Yes | QA-001, QA-009; AC-B001-5 |
| T-010 Edit completed workout updates history and statistics | Completed workout exists with one logged set. | Open History. Select `Edit`. Change reps or weight. Save. Open Progress/statistics. Reload. | Edited values appear in History and relevant statistics update immediately. | After reload, edited values and recalculated statistics remain. | Yes | QA-003, QA-005; MF-06, MF-08 |
| T-011 Delete completed workout updates statistics | Completed workout exists and contributes to History/Progress totals. | Open History. Select `Delete`. Confirm or allow undo to expire. Open Progress/statistics. Reload. | Deleted workout disappears from History. Totals and charts remove its contribution. | After reload, deleted workout remains absent and statistics stay recalculated. | Yes | QA-003; MF-06, MF-08 |
| T-012 Double-click `Log this set` saves one set | Active workout is visible and log sheet is open with valid values. | Double-click or double-tap `Log this set`. | Submit control visibly blocks repeat submission. Only one set chip/row appears. | After reload, the active or completed workout shows one new set, not two. | Yes | QA-004; AC-B003-1, AC-B003-3 |
| T-013 Double-click `Log & add another` saves one set | Active workout is visible and log sheet has valid values. | Double-click or double-tap `Log & add another`. | One set is added. The sheet remains ready for the next intentional set. No duplicate chip appears. | After reload, exactly one new set from that submission remains. | Yes | QA-004; AC-B003-2, AC-B003-3 |
| T-014 Invalid reps are rejected | Active workout is visible and log sheet is open. | Try reps values `0`, `-1`, `3.5`, `1e2`, blank, and an app-defined excessive value. Attempt to save each. | Field-specific reps error appears. Sheet stays open. No set is added for invalid input. | Reload shows no set created from invalid reps attempts. | Yes | QA-006; AC-B004-1, AC-B004-4 |
| T-015 Invalid weight is rejected | Active workout is visible and log sheet is open. | Try weight values `-20`, `1e3`, blank if weight is required, and an app-defined excessive value. Attempt to save each. | Field-specific weight error appears or bodyweight mode is explicitly selected. Sheet stays open. No invalid set is added. | Reload shows no set created from invalid weight attempts. | Yes | QA-006; AC-B004-2, AC-B004-4 |
| T-016 Valid numeric values persist exactly | Active workout is visible and log sheet is open. | Enter valid reps such as `10` and valid weight such as `12.5`. Save. Reload. | Saved set visibly shows `10` reps and `12.5` kg, or the product's explicitly formatted equivalent. | After reload, the same visible values remain unchanged. | No | QA-006; AC-B004-3 |
| T-017 Lock screen traps focus | Fresh launch is on the lock/open-profile screen. No profile is opened. | Press Tab repeatedly, then Shift+Tab repeatedly. | Focus cycles only through lock-screen controls. Background buttons, nav, and workout actions never receive focus. | Reload returns to locked state with no background action performed. | Yes | QA-008; AC-B005-1, AC-B005-2 |
| T-018 Locked background remains inert | Fresh launch is locked. No profile is opened. | Press Escape, Enter, Space, and Tab sequences that previously reached background controls. Attempt pointer interaction outside the lock card. | Lock screen remains active. No background menu opens, no workout action triggers, and no hidden app control becomes interactive. | Reload still shows locked state without unintended workout/profile changes. | Yes | QA-008; AC-B005-2, AC-B005-3 |
| T-019 Export, erase, and restore through visible UI | Local profile has at least one exercise and set. Data/backup panel is open. | Export backup. Import malformed JSON. Confirm data remains. Select `Erase all data`. Then select visible `Import data` and choose the exported backup. Reload. | Invalid import shows error and preserves data. After erase, import remains visible and clickable. Backup restore shows exercises and set history again. | After reload, restored exercises and sets are still visible. | Yes | QA-011; AC-B006-1, AC-B006-2, AC-B006-3 |
| T-020 Edit and safely delete an existing set | Active or completed workout contains one set. | Open the set details. Edit reps/weight and save. Then delete the set using confirmation or undo. Reload. | Edited set values update visible workout totals. Delete uses labeled controls and confirmation or undo before permanent removal. | After reload, edited values persist if kept; deleted set no longer contributes to workout or statistics. | Yes | QA-005; MF-07, MF-08 |
| T-021 Switch profiles without reload | Profile A and Profile B exist; Profile A has one set. | Open Profile A. Use profile pill or menu to switch to Profile B. Switch back to Profile A. | Switch controls are visible. Current profile label updates. Profile B does not show Profile A's set; Profile A still does. | After reload, the selected profile and its isolated data remain consistent. | Yes | QA-010 |
| T-022 Mobile toast does not cover primary logging action | Mobile viewport around 390 x 844. Local profile opened. | Immediately open a log set sheet after profile open. | Toast does not cover `Log this set` or other primary sheet actions. Touch targets remain visually clear. | Reload has no unintended set unless the user deliberately logged one. | Yes | QA-013 |
| T-023 First launch waits for user intent | Fresh browser context on first launch. | Open app and do not open or create a profile. Tab through visible controls. Reload. | First screen clearly asks to create/open a profile. No personal default profile appears as already selected, and background app content is not interactive. | Reload returns to the same no-profile-selected state. | Yes | QA-007, QA-008 |
| T-024 Future-dated import is not silently accepted | Local profile open. Backup file includes valid current sets plus future-dated sets. | Import the backup. If warned, cancel first, then repeat and confirm if product allows future dates. Open History. Reload. | App rejects future dates or presents an explicit warning. Future entries never silently appear above today as normal completed workouts. | Reload preserves the chosen outcome: rejected data absent, or confirmed future data clearly marked. | Yes | QA-012; MF-09 |
| T-025 PIN/password fields use browser-friendly form behavior | Lock screen and backup/PIN areas are available. Browser console capture is enabled by the test runner. | Submit the lock form by keyboard and open backup/PIN controls. | Keyboard form submission works visibly. No repeated browser password-field warnings are emitted during normal launch/use. | Reload behavior is unchanged; profile access still follows the intended lock/profile rules. | Yes | QA-014 |

## Acceptance Criteria Coverage Map

| Acceptance criterion | Covered by tests |
| --- | --- |
| AC-B001-1 | T-001 |
| AC-B001-2 | T-001, T-002, T-003 |
| AC-B001-3 | T-001, T-003, T-004 |
| AC-B001-4 | T-005 |
| AC-B001-5 | T-005, T-009 |
| AC-B001-6 | T-007, T-008 |
| AC-B002-1 | T-005 |
| AC-B002-2 | T-005 |
| AC-B002-3 | T-006 |
| AC-B003-1 | T-012 |
| AC-B003-2 | T-013 |
| AC-B003-3 | T-012, T-013 |
| AC-B004-1 | T-014 |
| AC-B004-2 | T-015 |
| AC-B004-3 | T-016 |
| AC-B004-4 | T-014, T-015 |
| AC-B005-1 | T-017 |
| AC-B005-2 | T-017, T-018 |
| AC-B005-3 | T-018 |
| AC-B006-1 | T-019 |
| AC-B006-2 | T-019 |
| AC-B006-3 | T-019 |

## Small Smoke-Test Suite

These are the critical user journeys to run first. They are a subset of the scenarios above, so the full preconditions, actions, expected results, reload persistence, current-failure expectation, and QA coverage are defined in the test table.

| Smoke ID | Scenario IDs | Critical journey | Current app expected result |
| --- | --- | --- | --- |
| SMK-01 | T-017, T-001, T-002 | Locked launch, start a workout, and prevent duplicate active workouts. | Fail |
| SMK-02 | T-004, T-012 | Log a set into an active workout, survive reload, and prevent duplicate set logging. | Fail |
| SMK-03 | T-005, T-006, T-009 | Finish workout once and verify completed History entry after reload. | Fail |
| SMK-04 | T-010, T-011 | Edit and delete a completed workout, then verify statistics after reload. | Fail |
| SMK-05 | T-019 | Export, erase, and restore data through visible controls. | Fail |

