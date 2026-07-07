# IronLog Black-Box QA Audit

Date: 2026-06-18  
Tester role: independent senior QA engineer / product usability tester  
Application URL tested: `http://127.0.0.1:8123/`  
Browser: Microsoft Edge launched through Playwright  
Source-code inspection: not performed  
Application file changes: none; this report is the only created artifact

## Scope and Method

I treated the app as a black box. I started the static app through a local HTTP server and operated it only through Playwright-driven browser interactions, rendered text, screenshots, console logs, dialogs, downloads, and browser storage evidence.

Coverage included fresh browser storage, persisted storage, desktop and mobile viewports, normal logging flows, adversarial input, reloads, import/export, offline mode after service-worker caching, keyboard navigation, profile isolation, and large history import.

## High-Level Result

The main user complaints are reproducible. The app stores individual dated sets, but it does not have a clear "Start workout -> active workout -> finished workout" lifecycle. Pressing "Finish today's workout" opens a summary sheet, then "Done" closes it and shows a "Workout saved" toast, but storage still contains only raw `sets` and `exercises`. History is an aggregation of raw dated sets, not a list of completed workouts. There is no visible way to edit or delete a historical workout.

Several non-complaint issues were also found: duplicate set submission, weak numeric validation, focus leakage behind the lock screen, missing set editing, immediate set deletion without confirmation/undo, import validation gaps, and mobile toast overlap.

## Confirmed Findings

### QA-001 - No Explicit Start/Active/Finish Workout Lifecycle

Severity: blocker

Preconditions:
- Fresh browser context.
- Local profile opened with "Use local only".

Exact reproduction steps:
1. Open the app.
2. Open a local profile.
3. Observe the Week screen before logging anything.
4. Log one set from the first exercise.
5. Press "Finish today's workout".
6. Press "Done".
7. Inspect History and browser storage.

Expected behavior:
- A user should be able to start a workout explicitly.
- During an active workout, the app should indicate active state and offer clear finish/cancel/abandon actions.
- Finishing should create a completed workout/session record separate from raw set rows.
- The finished workout should be visible in History as a completed workout.

Actual behavior:
- There is no "Start workout" control.
- The primary lifecycle action before any workout starts is already "Finish today's workout".
- Logging a set immediately writes a raw dated set.
- "Finish today's workout" opens a summary sheet but does not create a workout/session/completion object.
- After "Done", storage still contains only `exercises` and `sets`.
- History is built from raw sets grouped by date.

Evidence:
- Storage after finish: profile data keys were only `["exercises", "sets"]`; no key matching workout/session/history/completed/finished existed.
- Storage example after one set: `sets: [{ id, exId, date: "2026-06-18", ts, reps: 15, kg: 0 }]`.
- Screenshot evidence: after pressing "Finish today's workout", the app displayed a "Today's workout" summary with a single "Done" button, not a completion state.

Deterministic:
- Yes. Reproduced repeatedly on desktop and in lifecycle reload checks.

Suggested acceptance criteria:
- Week screen shows "Start workout" when no workout is active.
- Starting creates an active workout object with a stable id and start timestamp.
- Logging sets during the workout associates sets with that active workout id.
- Finishing persists a completed workout with start/end timestamps, set ids, summary totals, and completion status.
- History lists completed workouts distinctly from uncompleted/raw dated sets.

### QA-002 - Finish Requires a Second Confirmation and Gives Misleading Save Feedback

Severity: high

Preconditions:
- Local profile opened.
- At least one set logged today.

Exact reproduction steps:
1. Log one set.
2. Press "Finish today's workout".
3. Observe the summary sheet.
4. Press "Done".
5. Inspect storage and History.

Expected behavior:
- If the button says "Finish today's workout", pressing it should finish and save the workout, or the button should clearly say "Review today's workout" if it only opens a summary.
- Any second confirmation should be explicit, such as "Save completed workout", and should persist a completed workout record.

Actual behavior:
- First press only opens a summary.
- Second press says "Done" rather than "Save workout" or "Finish workout".
- A "Workout saved" toast appears, but no completed workout record is saved.

Evidence:
- Storage after "Done" still had only `exercises` and `sets`.
- UI text evidence: History showed "Today - 1 sets - 1 exercises"; no completed workout state, finish timestamp, or delete/edit actions.

Deterministic:
- Yes.

Suggested acceptance criteria:
- "Finish today's workout" either completes the workout on first click or opens a review sheet whose primary CTA is unambiguous, such as "Save completed workout".
- After completion, storage includes a completed workout/session record.
- The toast text must reflect the actual action performed.

### QA-003 - Historical Workouts Cannot Be Edited or Deleted

Severity: high

Preconditions:
- Local profile has at least one logged set.
- Finish flow has been completed with "Done".

Exact reproduction steps:
1. Log one set.
2. Press "Finish today's workout".
3. Press "Done".
4. Open the History tab.
5. Expand the "Today" row.
6. Look for edit/delete controls for the history item.

Expected behavior:
- A completed workout in History should have visible edit and delete affordances.
- Destructive deletion should require confirmation or provide undo.
- Editing should allow correction of workout metadata and contained sets.

Actual behavior:
- History row expands to show set details only.
- There are no visible edit or delete controls for the historical workout/day.
- The history row itself is a clickable card, not a conventional button.

Evidence:
- Screenshot evidence: expanded History row displayed `Pushups - 1 set - 15xBW` and no edit/delete controls.
- Rendered controls evidence: visible buttons in History were profile/menu/nav and hidden off-screen modal buttons; none were history edit/delete.

Deterministic:
- Yes.

Suggested acceptance criteria:
- Each history workout row exposes "Edit" and "Delete" actions.
- Keyboard and screen-reader users can focus and activate the row and its actions.
- Deleting a historical workout removes or archives the associated completed workout and updates weekly totals predictably.

### QA-004 - Double-Clicking "Log This Set" Creates Duplicate Sets

Severity: high

Preconditions:
- Local profile opened.
- Log set sheet open for an exercise.

Exact reproduction steps:
1. Open the log set sheet for Pushups.
2. Double-click "Log this set".
3. Inspect the Week screen and storage.

Expected behavior:
- A duplicate click should not create duplicate logged sets.
- The primary button should disable during submission or otherwise debounce the action.

Actual behavior:
- Two identical sets are saved.
- The two saved set timestamps were 26 ms apart.

Evidence:
- Storage after double-click:
  - Set 1: `reps: 15`, `kg: 0`, `ts: 1781808307917`
  - Set 2: `reps: 15`, `kg: 0`, `ts: 1781808307943`
- Week screen showed `2/4` and two `15xBW` chips.

Deterministic:
- Yes.

Suggested acceptance criteria:
- A rapid double-click/tap on set logging creates at most one set.
- The button enters a disabled/submitting state until the first submission completes.
- Duplicate-prevention behavior is covered for both "Log this set" and "Log & add another".

### QA-005 - Logged Sets Cannot Be Edited and Are Deleted Immediately

Severity: medium

Preconditions:
- Local profile opened.
- At least one set logged.

Exact reproduction steps:
1. Log one set.
2. On the Week screen, inspect the logged set chip.
3. Try to edit the set value.
4. Click the visible `x` on the set chip.

Expected behavior:
- A logged set should be editable, especially for common mistakes in reps or weight.
- Delete should require confirmation or provide undo.
- The delete target should be an accessible button with a clear label.

Actual behavior:
- No edit affordance was found for an existing set.
- Clicking the set chip `x` immediately removed the set.
- No dialog, confirmation, or undo appeared.

Evidence:
- Storage before delete: `sets.length === 1`.
- Storage after clicking the chip `x`: `sets.length === 0`.
- Dialog evidence: no browser dialog fired during set deletion.

Deterministic:
- Yes.

Suggested acceptance criteria:
- Existing sets can be edited from Week and History detail.
- Deleting a set uses a labeled button and either confirmation or undo.
- Deleting updates Week, History, and Progress consistently.

### QA-006 - Numeric Input Validation Is Inconsistent and Allows Corrupt Workout Data

Severity: medium

Preconditions:
- Local profile opened.
- Log set sheet open.

Exact reproduction steps:
1. Open a log set sheet.
2. Try edge values in reps and weight.
3. Submit each case.
4. Inspect storage.

Expected behavior:
- Reps should be positive whole numbers.
- Weight should be finite, non-negative, and within a realistic app-defined maximum.
- Decimal or exponent notation should either be rejected with a clear message or parsed correctly and visibly.
- Extreme values should be rejected or require confirmation.

Actual behavior:
- Blank/zero/negative reps were blocked with "Enter reps".
- Decimal reps were silently truncated: input `3.5` saved as `3`.
- Exponent reps were mis-parsed: input `1e2` saved as `1`.
- Exponent weight `1e3` saved as `1000`.
- Negative weight was accepted: input `-20` saved as `kg: -20`.
- Extreme values were accepted: `999999` reps and `999999` kg saved.

Evidence:
- Storage examples:
  - `3.5` reps -> saved `reps: 3`
  - `1e2` reps and `1e3` kg -> saved `reps: 1`, `kg: 1000`
  - `10` reps and `-20` kg -> saved `kg: -20`
  - `999999` reps -> saved `reps: 999999`

Deterministic:
- Yes.

Suggested acceptance criteria:
- Reps accept only positive integers in a sane range.
- Weight accepts only finite non-negative decimals in a sane range.
- The value saved equals the value visibly accepted, or validation blocks submission.
- Validation errors identify the field and reason.

### QA-007 - Fresh Launch Creates a Default Profile and Program Before User Intent

Severity: medium

Preconditions:
- Fresh browser context with empty local storage.

Exact reproduction steps:
1. Open the app in a fresh context.
2. Before pressing "Use local only" or "Open profile", inspect browser storage.
3. Observe the lock screen.

Expected behavior:
- Fresh launch should not create profile data before the user chooses or opens a profile.
- The empty state should be explicit: no profile selected, no user data created.

Actual behavior:
- The lock screen is prefilled with `lucas`.
- Local storage already contains `ironlog.v2.lucas` with the full default exercise program.
- App content is rendered behind the lock screen.

Evidence:
- Fresh-context storage contained `ironlog.v2.lucas` with `15` exercises and `0` sets before explicit profile action.
- Screenshot evidence: lock screen showed profile name `lucas` prefilled.

Deterministic:
- Yes in fresh browser contexts.

Suggested acceptance criteria:
- No profile-scoped data is written until the user opens or creates a profile.
- The first-launch screen clearly distinguishes "create local profile", "open existing profile", and sample/demo data.
- The app behind the lock screen is inert until profile open.

### QA-008 - Keyboard Focus Leaks Behind the Lock Screen

Severity: high

Preconditions:
- Fresh browser context on the first lock screen.
- Do not open a profile.

Exact reproduction steps:
1. Open the app.
2. Press Tab repeatedly.
3. Record the focused element sequence.

Expected behavior:
- Focus should be trapped inside the lock/open-profile card.
- Background app controls should not be reachable until the profile is opened.

Actual behavior:
- After four Tab presses through the lock card, focus moved into the app behind it.
- Focus reached profile pill, menu, mode buttons, "Finish today's workout", grouping buttons, and exercise controls.

Evidence:
- Focus sequence:
  1. `#gateProfile`
  2. `#gatePin`
  3. `#gateOpenBtn`
  4. `#gateLocalBtn`
  5. `#profilePill`
  6. `#menuBtn`
  7. "Maintaining"
  8. "Building"
  9. "Beast mode"
  10. "Finish today's workout"

Deterministic:
- Yes.

Suggested acceptance criteria:
- While the lock screen is open, all background app content is hidden from keyboard and assistive technology.
- Tab and Shift+Tab cycle only through lock-screen controls.
- Escape behavior is defined and tested.

### QA-009 - History Rows Are Not Exposed as Conventional Buttons

Severity: medium

Preconditions:
- History contains at least one day/workout row.

Exact reproduction steps:
1. Open History.
2. Try to identify/activate the row using role-based controls.
3. Click the visible row text to expand it.

Expected behavior:
- Expandable history rows should be keyboard-focusable buttons or disclosures.
- They should expose name, expanded/collapsed state, and keyboard activation.

Actual behavior:
- The row can be clicked visually.
- It is not exposed as a normal button in the visible controls list.
- Playwright role targeting could not use a clear row button; direct text/card click was required.

Evidence:
- Visible row text: `Today - 1 sets - 1 exercises - >`.
- Visible buttons in History did not include the history row.

Deterministic:
- Yes.

Suggested acceptance criteria:
- History rows use button/disclosure semantics.
- Enter/Space toggles the row.
- The row exposes expanded/collapsed state to assistive technologies.

### QA-010 - Profile Switching Is Not Discoverable

Severity: low

Preconditions:
- Local profile A opened.

Exact reproduction steps:
1. Open profile `qa_profile_a`.
2. Log one set.
3. Click the profile pill labeled `qa_profile_a`.
4. Attempt to switch to profile `qa_profile_b`.

Expected behavior:
- Clicking the profile pill or menu should offer a clear switch/logout/open profile path.

Actual behavior:
- Clicking the profile pill did not show the lock/open-profile screen.
- Switching was possible only by reloading, then using the gate screen.
- Storage isolation itself worked: profile B started with `0` sets while profile A retained `1` set.

Evidence:
- Storage keys in one context included `ironlog.v2.qa_profile_a` and `ironlog.v2.qa_profile_b`.
- `qa_profile_a` retained `1` set; `qa_profile_b` had `0` sets.

Deterministic:
- Yes.

Suggested acceptance criteria:
- Profile pill opens a profile menu with Switch profile, Lock, and Backup options.
- Switching profiles does not require a page reload.
- The current profile remains visually obvious after switching.

### QA-011 - Import/Erase Flow Can Leave Import Button Unclickable

Severity: medium

Preconditions:
- Local profile opened.
- Data & backup panel open.
- At least one set exported.

Exact reproduction steps:
1. Open the Data & backup panel.
2. Export data.
3. Import malformed JSON and observe rejection.
4. Press "Erase all data" and confirm.
5. Try to click "Import data (JSON)" again in the same panel.

Expected behavior:
- After erasing data, backup controls should remain visible and clickable.
- A user should be able to immediately import an exported backup.

Actual behavior:
- Invalid import correctly showed "Could not read file" and preserved data.
- Erase confirmed with `Erase ALL data? Cannot be undone.` and cleared data.
- After erase, Playwright could no longer click the visible Import button because it was reported as outside the viewport.
- Directly setting the existing file input still imported successfully, which suggests the import backend worked but the UI became unreachable in that state.

Evidence:
- Export file: `ironlog-2026-06-18.json`, keys `["exercises", "sets"]`, `15` exercises, `1` set.
- Invalid import evidence: storage still had `1` set and toast text "Could not read file".
- Erase evidence: storage had `0` exercises and `0` sets.
- Click evidence: Playwright click failed with "element is outside of the viewport"; direct file input import restored `15` exercises and `1` set.

Deterministic:
- Reproduced once during the import/export scenario. Needs a second UI-only confirmation before release triage, but the evidence is actionable.

Suggested acceptance criteria:
- Data & backup panel remains stable after erase.
- Import button remains in viewport and clickable.
- Importing a just-exported backup is possible through the visible UI without direct file-input access.

### QA-012 - Import Accepts Future-Dated and Unbounded History Data

Severity: medium

Preconditions:
- Local profile opened.
- Import JSON available with many dated sets, including future dates.

Exact reproduction steps:
1. Import a JSON backup containing 1,260 sets over 420 days.
2. Include dates after the current date of 2026-06-18.
3. Open History.

Expected behavior:
- Import should validate date ranges and schema.
- Future-dated sets should be rejected, warned about, or clearly marked.
- Large imports should be bounded or virtualized enough to remain performant.

Actual behavior:
- Import accepted all 1,260 sets.
- History showed `420 days`.
- Future dates appeared above today, e.g. `Wed, 8 Jul`, `Tue, 7 Jul`, before `Today`.
- Rendering was usable in this run but created a very long page.

Evidence:
- Storage after import: `sets.length === 1260`.
- History text: `History - 420 days`.
- Page scroll height: `32519`.
- History render observation after clicking History: approximately `1115 ms` wait in the Playwright scenario.

Deterministic:
- Yes for the imported payload.

Suggested acceptance criteria:
- Import validates required fields, known exercise references, finite numeric values, and date bounds.
- Future dates require explicit confirmation or are rejected.
- Large history views remain responsive and avoid rendering excessive DOM at once.

### QA-013 - Mobile Toast Overlaps the Primary Log Button

Severity: low

Preconditions:
- Mobile viewport around `390 x 844`.
- Local profile opened.
- Immediately open a log set sheet.

Exact reproduction steps:
1. Open the app in mobile viewport.
2. Use "Use local only".
3. Tap the first exercise plus button.
4. Observe the bottom sheet.

Expected behavior:
- Toasts should not obscure primary action buttons, especially on touch layouts.

Actual behavior:
- The "Local profile opened" toast visually overlays the "Log this set" button in the bottom sheet.
- Logging still succeeded in the automated run, but the button was visually obstructed.

Evidence:
- Screenshot evidence: mobile bottom sheet showed the toast centered over the orange "Log this set" button.
- Storage after tapping/logging still saved one set, so this is primarily a usability/touch confidence issue.

Deterministic:
- Reproduced in the mobile flow when opening the sheet soon after profile open.

Suggested acceptance criteria:
- Toasts avoid modal primary action areas.
- Bottom sheets reserve safe space for transient messages or place toasts above the sheet.
- Touch targets remain visually unobstructed.

### QA-014 - Password Fields Trigger Browser Form Warnings

Severity: low

Preconditions:
- Open the app or Data & backup panel.

Exact reproduction steps:
1. Open the app.
2. Observe browser console logs.

Expected behavior:
- Password/PIN inputs should be contained in forms or otherwise use browser-friendly semantics.

Actual behavior:
- Chromium logs repeated warnings that password fields are not contained in a form.

Evidence:
- Console evidence repeated across contexts:
  - `[DOM] Password field is not contained in a form: (More info: https://www.chromium.org/developers/design-documents/create-amazing-password-forms)`

Deterministic:
- Yes.

Suggested acceptance criteria:
- PIN/password fields use form semantics, autocomplete attributes, and accessible labels appropriate to the intended security model.
- Console is free of repeated browser form warnings during normal launch.

## Positive Observations

- Add, edit, and remove exercise flows worked for a normal custom exercise.
- Removing an exercise showed a confirmation dialog and stated logged history is kept.
- User-entered script-like exercise names and notes rendered as literal text and did not trigger alert dialogs in the tested flow.
- Export produced a JSON file with `exercises` and `sets`.
- Invalid JSON import did not overwrite existing data.
- Valid JSON import restored data.
- Profile storage was isolated between two named local profiles.
- Offline reload and offline set logging worked after the service worker had cached the app.
- Large History import rendered successfully in the tested desktop run, though it exposed validation and scalability concerns.

## Classification Summary

Confirmed bugs:
- QA-001: No persisted completed workout lifecycle.
- QA-002: Finish/Done flow gives misleading save feedback.
- QA-004: Double-click set logging creates duplicates.
- QA-006: Numeric values are silently truncated/mis-parsed or allow invalid values.
- QA-008: Keyboard focus leaks behind the lock screen.
- QA-011: Import button can become unreachable after erase.

Usability problems:
- QA-003: History lacks visible edit/delete controls.
- QA-005: Set delete is immediate and set editing is absent.
- QA-009: History rows are not conventional buttons/disclosures.
- QA-010: Profile switching is not discoverable.
- QA-013: Mobile toast overlaps primary action.
- QA-014: Browser form warnings for PIN fields.

Missing functionality:
- Explicit Start workout action.
- Active workout state.
- Cancel/abandon active workout.
- Persisted completed workout records.
- Edit/delete historical workouts.
- Edit existing logged sets.

Ambiguous product decisions:
- Whether a "workout" is meant to be a formal session or just all sets logged on a calendar day.
- Whether deleting a historical workout should delete contained sets, archive the workout, or detach it from weekly totals.
- Whether empty weight should mean bodyweight/0 kg or should require an explicit bodyweight toggle.
- Whether future-dated imports should ever be allowed.
- Whether local-only profile access should require a PIN or intentionally bypass cloud/PIN authentication.

## Proposed Workout Lifecycle Behavior Specification

This specification is proposed behavior, not an implementation plan.

### Entities

- Exercise: a program item with name, muscle, area, target sets, rep range, increment, notes, and active/removed status.
- Workout: a user-started session with id, profile id, status, start time, optional end time, and ordered set ids.
- Set: a logged performance entry with id, workout id, exercise id, reps, weight, timestamp, and optional note.

### States

- No active workout:
  - Week screen shows "Start workout".
  - Users may still browse plan, history, progress, and catalog.
  - If the product allows quick logging without start, the app must explicitly create or resume a workout before saving the set.

- Active workout:
  - Created by pressing "Start workout" or by confirming quick-log start.
  - Screen shows "Workout in progress" with elapsed time and logged set count.
  - Primary actions are "Finish workout" and "Cancel workout".
  - Logged sets are attached to the active workout.
  - Reload restores the active workout and its sets.

- Finish review:
  - Pressing "Finish workout" opens an optional review sheet.
  - The review sheet shows sets, exercises, muscles, start/end time preview, and validation warnings.
  - Primary CTA says "Save completed workout".
  - Secondary CTA says "Keep editing" or "Back".

- Completed workout:
  - Saving writes a completed workout record with end timestamp.
  - History lists it as a completed workout.
  - The completed workout can be opened, edited, exported, and deleted.
  - Deleting requires confirmation or undo.

- Cancelled/abandoned workout:
  - If no sets were logged, cancel discards the active workout.
  - If sets were logged, the user chooses:
    - Keep sets and save as completed,
    - Save as draft/incomplete,
    - Delete the active workout and its sets.
  - Reload after abandonment should never silently lose logged data.

### Acceptance Criteria for Lifecycle

1. Fresh profile shows no active workout and a clear "Start workout" CTA.
2. Pressing "Start workout" creates an active workout in storage.
3. Logging a set during an active workout associates it with that workout id.
4. Reload during active workout restores the active workout state.
5. Pressing "Finish workout" does not merely close a modal; it either completes immediately or presents a clearly labeled "Save completed workout" CTA.
6. Saving completion creates a completed workout record with start/end timestamps.
7. History shows completed workouts, not only raw dates.
8. History entries have edit and delete actions.
9. Duplicate clicks cannot create duplicate workouts or duplicate sets.
10. Cancel/abandon behavior is explicit and preserves user data unless the user confirms deletion.
11. Imported data must preserve lifecycle invariants or be rejected with a clear error.
