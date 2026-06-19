const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

const gateHeading = /Open IronLog/i;

async function resetBrowserState(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter(Boolean)
          .map(
            (name) =>
              new Promise((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = request.onerror = request.onblocked = () => resolve();
              }),
          ),
      );
    }
  });
  await page.goto('/');
}

async function visible(locator) {
  return locator.first().isVisible().catch(() => false);
}

async function clickIfVisible(locator) {
  if (await visible(locator)) {
    await locator.first().click();
    return true;
  }
  return false;
}

function profileName(testInfo, suffix = '') {
  return `smoke_${testInfo.parallelIndex}_${testInfo.workerIndex}_${Date.now()}${suffix}`;
}

async function openLocalProfile(page, name) {
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  await page.locator('#profileGate').getByPlaceholder('e.g. lucas').fill(name);
  await page.getByRole('button', { name: /Use local only/i }).click();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
}

async function expectStillAuthenticatedAfterRefresh(page) {
  await page.reload();
  await expect.soft(
    page.getByRole('heading', { name: gateHeading }),
    'AC-B001-3 / refresh auth: a previously opened local profile should remain in the app after a normal refresh',
  ).toBeHidden();
}

async function expectIdleWorkoutState(page) {
  await expect.soft(
    page.getByRole('button', { name: /^Start workout$/i }),
    'AC-B001-1: idle Week screen should expose Start workout',
  ).toBeVisible();
  await expect.soft(
    page.getByRole('button', { name: /Finish.*workout/i }),
    'AC-B001-1: idle Week screen should not expose Finish workout as the primary lifecycle action',
  ).toHaveCount(0);
}

async function startWorkoutIfAvailable(page) {
  const start = page.getByRole('button', { name: /^Start workout$/i });
  await expect.soft(start, 'AC-B001-2: Start workout should be available before creating an active workout').toBeVisible();
  if (await clickIfVisible(start)) {
    await expectActiveWorkoutState(page, 0);
  }
}

async function expectActiveWorkoutState(page, setCountPattern = /\b0\b.*sets|\b0 sets\b/i) {
  await expect.soft(
    page.getByText(/Workout in progress|Active workout|Resume workout|Started|Elapsed/i).first(),
    'AC-B001-2: starting should show a visible active workout state with start or elapsed information',
  ).toBeVisible();
  await expect.soft(
    page.getByText(setCountPattern).first(),
    'AC-B001-2 / AC-B001-3: active workout should show its set count',
  ).toBeVisible();
  await expect.soft(
    page.getByRole('button', { name: /^Finish workout$/i }),
    'AC-B001-2: active workout should expose Finish workout',
  ).toBeVisible();
  await expect.soft(
    page.getByRole('button', { name: /^Cancel workout$/i }),
    'AC-B001-2: active workout should expose Cancel workout',
  ).toBeVisible();
}

async function openFirstLogSheet(page) {
  const logButtons = page.locator('button[title="Log set"]');
  await expect(logButtons.first()).toBeVisible();
  await logButtons.first().click();
  await expect(page.getByRole('button', { name: /Log this set/i })).toBeVisible();
}

function repsInput(page) {
  return page.locator('.stepwrap', { hasText: 'Reps' }).locator('input');
}

function weightInput(page) {
  return page.locator('.stepwrap', { hasText: 'Weight (kg)' }).locator('input');
}

async function fillSet(page, reps = '10', weight = '12.5') {
  await repsInput(page).fill(reps);
  await weightInput(page).fill(weight);
}

async function logOneSet(page, reps = '10', weight = '12.5') {
  await openFirstLogSheet(page);
  await fillSet(page, reps, weight);
  await page.getByRole('button', { name: /Log this set/i }).click();
  await expect(loggedSetChips(page)).toHaveCount(1);
}

function loggedSetChips(page) {
  return page.locator('#weekList .wkchips .wkchip');
}

async function openHistory(page) {
  await page.locator('nav').getByRole('button', { name: /History/i }).click();
  await expect(page.getByRole('heading', { name: /^History$/i })).toBeVisible();
}

function completedWorkoutRows(page) {
  return page.getByRole('button', { name: /completed workout|workout session|session|duration/i });
}

async function finishWorkoutThroughExpectedFlow(page) {
  const exactFinish = page.getByRole('button', { name: /^Finish workout$/i });
  await expect.soft(exactFinish, 'AC-B002-1: completion action should be labeled Finish workout').toBeVisible();

  if (!(await clickIfVisible(exactFinish))) {
    await page.getByRole('button', { name: /Finish.*workout/i }).first().click();
  }

  const save = page.getByRole('button', { name: /^Save completed workout$/i });
  await expect.soft(save, 'AC-B002-1: finish review primary CTA should be Save completed workout').toBeVisible();
  if (!(await clickIfVisible(save))) {
    await clickIfVisible(page.getByRole('button', { name: /^Done/i }));
  }
}

async function prepareCurrentWorkoutData(page, testInfo, suffix = '') {
  const name = profileName(testInfo, suffix);
  await openLocalProfile(page, name);
  await logOneSet(page);
  return name;
}

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page);
});

test('SMK-00 app opens without a fatal error', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.reload();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  await expect(page.getByText('IronLog').first()).toBeVisible();
  expect(pageErrors, 'Smoke item 1: app should open without uncaught page errors').toEqual([]);
});

test('SMK-01 new user setup, refresh auth, locked focus, and start lifecycle', async ({ page }, testInfo) => {
  const name = profileName(testInfo);

  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    const focusedText = await page.evaluate(() => document.activeElement?.textContent || document.activeElement?.getAttribute('placeholder') || '');
    expect.soft(
      focusedText,
      `AC-B005-1 / AC-B005-2: Tab step ${index + 1} should stay inside the lock/open-profile controls`,
    ).toMatch(/profile|pin|open profile|use local only|e\.g\. lucas|your profile pin/i);
  }

  await openLocalProfile(page, name);
  await expectIdleWorkoutState(page);
  await startWorkoutIfAvailable(page);

  const start = page.getByRole('button', { name: /^Start workout$/i });
  if (await visible(start)) {
    await start.dblclick();
  }
  await expect.soft(
    page.getByRole('button', { name: /^Start workout$/i }),
    'SMK-01 / T-002: once active, repeated starts should be hidden, disabled, or replaced by Resume workout',
  ).toHaveCount(0);

  await expectStillAuthenticatedAfterRefresh(page);
});

test('SMK-02 log a set, block duplicate submission, and persist after reload', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkoutIfAvailable(page);

  await openFirstLogSheet(page);
  await fillSet(page);
  await page.getByRole('button', { name: /Log this set/i }).dblclick();

  await expect.soft(
    loggedSetChips(page),
    'AC-B003-1 / AC-B003-3: rapid repeated Log this set activation should create at most one visible set',
  ).toHaveCount(1);
  await expect.soft(
    page.getByText(/10\s*[×x]\s*12\.5\s*kg/i).first(),
    'Smoke item 4: the logged set should be visible with the entered reps and weight',
  ).toBeVisible();
  await expectActiveWorkoutState(page, /\b1\b.*sets|\b1 set\b/i);

  await page.reload();
  await expect.soft(
    page.getByRole('heading', { name: gateHeading }),
    'Smoke item 5 / item 11: logged-in state should survive reload while checking logged data persistence',
  ).toBeHidden();
  if (await visible(page.getByRole('button', { name: /Use local only/i }))) {
    await page.getByRole('button', { name: /Use local only/i }).click();
  }
  await expect.soft(
    loggedSetChips(page),
    'AC-B001-3 / Smoke item 5: the same single logged set should remain after reload',
  ).toHaveCount(1);
});

test('SMK-03 finish workout once and show exactly one completed history entry after reload', async ({ page }, testInfo) => {
  await prepareCurrentWorkoutData(page, testInfo);

  await finishWorkoutThroughExpectedFlow(page);
  await openHistory(page);
  await expect.soft(
    completedWorkoutRows(page),
    'AC-B001-5: History should expose the completed workout as an accessible session row',
  ).toHaveCount(1);

  await page.reload();
  if (await visible(page.getByRole('button', { name: /Use local only/i }))) {
    await page.getByRole('button', { name: /Use local only/i }).click();
  }
  await openHistory(page);
  await expect.soft(
    completedWorkoutRows(page),
    'AC-B001-4 / AC-B002-2: the completed workout should remain exactly once after reload',
  ).toHaveCount(1);
});

test('SMK-04 delete completed workout and keep it deleted after reload', async ({ page }, testInfo) => {
  await prepareCurrentWorkoutData(page, testInfo);
  await finishWorkoutThroughExpectedFlow(page);
  await openHistory(page);

  await expect.soft(
    completedWorkoutRows(page),
    'MF-06 setup: a completed workout should exist before testing deletion',
  ).toHaveCount(1);

  const deleteButton = page.getByRole('button', { name: /^Delete$/i });
  await expect.soft(deleteButton, 'MF-06 / Smoke item 9: a completed History entry should expose Delete').toBeVisible();
  if (await visible(deleteButton)) {
    page.once('dialog', (dialog) => dialog.accept());
    await deleteButton.click();
  }

  await expect.soft(
    completedWorkoutRows(page),
    'Smoke item 9: deleted completed workout should disappear from History',
  ).toHaveCount(0);

  await page.reload();
  if (await visible(page.getByRole('button', { name: /Use local only/i }))) {
    await page.getByRole('button', { name: /Use local only/i }).click();
  }
  await openHistory(page);
  await expect.soft(
    completedWorkoutRows(page),
    'Smoke item 10: deleted completed workout should remain absent after reload',
  ).toHaveCount(0);
});

test('SMK-05 export, erase, and restore through visible controls', async ({ page }, testInfo) => {
  const name = await prepareCurrentWorkoutData(page, testInfo);
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export data/i }).click(),
  ]);
  const backupPath = testInfo.outputPath('ironlog-export.json');
  await download.saveAs(backupPath);

  const invalidPath = testInfo.outputPath('invalid-import.json');
  fs.writeFileSync(invalidPath, '{ invalid json', 'utf8');

  const importButton = page.getByRole('button', { name: /Import data/i });
  let chooserPromise = page.waitForEvent('filechooser');
  await importButton.click();
  let chooser = await chooserPromise;
  await chooser.setFiles(invalidPath);
  await expect(page.getByText(/Could not read file|Invalid file/i)).toBeVisible();
  await expect.soft(importButton, 'AC-B006-1: invalid import should leave backup controls usable').toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Erase all data/i }).click();

  await expect.soft(
    importButton,
    'AC-B006-2: after Erase all data, the visible Import data control should remain reachable',
  ).toBeVisible();

  if (await visible(importButton)) {
    chooserPromise = page.waitForEvent('filechooser');
    await importButton.click();
    chooser = await chooserPromise;
    await chooser.setFiles(backupPath);
    await expect(page.getByText(/Imported/i)).toBeVisible();
  }

  await page.reload();
  if (await visible(page.getByRole('button', { name: /Use local only/i }))) {
    await page.getByRole('button', { name: /Use local only/i }).click();
  }
  await expect.soft(
    loggedSetChips(page),
    'AC-B006-3: restored backup data should remain visible after reload',
  ).toHaveCount(1);
});
