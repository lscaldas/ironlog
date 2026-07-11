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

function profileName(testInfo, suffix = '') {
  return `full_${testInfo.parallelIndex}_${testInfo.workerIndex}_${Date.now()}${suffix}`;
}

async function visible(locator) {
  return locator.first().isVisible().catch(() => false);
}

async function openLocalProfile(page, name) {
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  await page.locator('#profileGate').getByPlaceholder('e.g. lucas').fill(name);
  await page.getByRole('button', { name: /Use local only/i }).click();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
}

async function logout(page, name) {
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  await expect(page.getByRole('heading', { name: /^Profile$/i })).toBeVisible();
  await page.getByRole('button', { name: /^Log out$/i }).click();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
}

async function startWorkout(page) {
  const start = page.getByRole('button', { name: /^Start workout$/i });
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.getByText(/Workout in progress/i)).toBeVisible();
}

async function cancelWorkout(page, acceptDialog) {
  const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
    if (acceptDialog) await dialog.accept();
    else await dialog.dismiss();
    return dialog.message();
  }).catch(() => null);

  await page.getByRole('button', { name: /^Cancel workout$/i }).click();
  return dialogPromise;
}

async function openFirstLogSheet(page) {
  const logButtons = page.locator('button[title="Log set"]');
  await expect(logButtons.first()).toBeVisible();
  await logButtons.first().click();
  await expect(page.getByRole('button', { name: /Log this set/i })).toBeVisible();
}

function repsInput(page) {
  return page.locator('#inReps');
}

function weightInput(page) {
  return page.locator('#inKg');
}

async function fillSet(page, reps = '10', weight = '12.5') {
  await repsInput(page).fill(reps);
  await weightInput(page).fill(weight);
}

function loggedSetChips(page) {
  return page.locator('#weekList .wkchips .wkchip');
}

async function logOneSet(page, reps = '10', weight = '12.5') {
  await openFirstLogSheet(page);
  await fillSet(page, reps, weight);
  await page.getByRole('button', { name: /Log this set/i }).click();
  await expect(loggedSetChips(page)).toHaveCount(1);
}

async function openHistory(page) {
  await page.locator('nav').getByRole('button', { name: /History/i }).click();
  await expect(page.getByRole('heading', { name: /^History$/i })).toBeVisible();
}

async function openStats(page) {
  await page.locator('nav').getByRole('button', { name: /Progress/i }).click();
  await expect(page.locator('#v-stats')).toHaveClass(/active/);
}

function statValue(page, label) {
  return page.locator('.stat', { hasText: label }).locator('.n');
}

async function finishWorkout(page) {
  await page.getByRole('button', { name: /^Finish workout$/i }).click();
  await expect(page.getByRole('heading', { name: /^Finish workout$/i })).toBeVisible();
  await page.getByRole('button', { name: /^Save completed workout$/i }).click();
  await expect(page.getByText(/Workout saved/i)).toBeVisible();
}

async function importJson(page, testInfo, fileName, payload) {
  const filePath = testInfo.outputPath(fileName);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import data/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
  return filePath;
}

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page);
});

test('T-007 cancel empty active workout returns to idle and persists after reload', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);

  await cancelWorkout(page, true);
  await expect(page.getByText(/No active workout/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start workout$/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeHidden();
  await expect(page.getByText(/No active workout/i)).toBeVisible();
  await openHistory(page);
  await expect(page.getByText(/No sets logged yet/i)).toBeVisible();
});

test('T-008 cancelling a workout with sets requires an explicit choice and preserves or deletes accordingly', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page);

  const dismissMessage = await cancelWorkout(page, false);
  expect.soft(dismissMessage, 'Cancellation with logged sets should ask before deleting data.').toMatch(/delete its logged sets/i);
  await expect(page.getByText(/Workout in progress/i)).toBeVisible();
  await expect(loggedSetChips(page)).toHaveCount(1);

  await page.reload();
  await expect(loggedSetChips(page)).toHaveCount(1);

  const acceptMessage = await cancelWorkout(page, true);
  expect.soft(acceptMessage, 'Confirmed cancellation should use the same explicit data-loss prompt.').toMatch(/delete its logged sets/i);
  await expect(page.getByText(/No active workout/i)).toBeVisible();
  await expect(loggedSetChips(page)).toHaveCount(0);

  await page.reload();
  await expect(loggedSetChips(page)).toHaveCount(0);
});

test('T-013 rapid Log and add another activation creates one set and leaves the sheet ready', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await openFirstLogSheet(page);
  await fillSet(page, '8', '20');

  await page.getByRole('button', { name: /Log & add another/i }).dblclick();

  await expect(loggedSetChips(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Log this set/i })).toBeVisible();
  await expect(page.locator('#logSub')).toContainText(/Set 2/i);

  await page.reload();
  await expect(loggedSetChips(page)).toHaveCount(1);
});

test('T-014 invalid reps are rejected without creating sets', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await openFirstLogSheet(page);

  for (const reps of ['0', '-1', '3.5', '1e2', '', '1000']) {
    await fillSet(page, reps, '12.5');
    await page.getByRole('button', { name: /Log this set/i }).click();
    await expect(page.locator('#logSheet')).toHaveClass(/show/);
    await expect(page.locator('#toast')).toContainText(/Reps must/i);
    await expect(loggedSetChips(page), `Invalid reps "${reps}" should not create a visible set.`).toHaveCount(0);
  }

  await page.reload();
  await expect(loggedSetChips(page)).toHaveCount(0);
});

test('T-015 invalid weights are rejected without creating sets', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await openFirstLogSheet(page);

  for (const weight of ['-20', '1e3', '12.345', '1000']) {
    await fillSet(page, '10', weight);
    await page.getByRole('button', { name: /Log this set/i }).click();
    await expect(page.locator('#logSheet')).toHaveClass(/show/);
    await expect(page.locator('#toast')).toContainText(/Weight must/i);
    await expect(loggedSetChips(page), `Invalid weight "${weight}" should not create a visible set.`).toHaveCount(0);
  }

  await page.reload();
  await expect(loggedSetChips(page)).toHaveCount(0);
});

test('weekly loadout excludes rested groups without locking their exercises', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);

  await expect(page.getByRole('heading', { name: /^Weekly quest$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Next quest$/i })).toBeVisible();
  await expect(page.locator('#ringTxt')).toHaveText('0/50 sets');

  const legsRole = page.getByLabel('Legs weekly role', { exact: true });
  await legsRole.selectOption('rest');
  await expect(page.locator('#ringTxt')).toHaveText('0/40 sets');

  await startWorkout(page);
  const cableSquats = page.locator('#weekList .ex', { hasText: 'Cable Squats' });
  await expect(cableSquats).toBeVisible();
  await cableSquats.locator('button[title="Log set"]').click();
  await fillSet(page, '8', '20');
  await page.getByRole('button', { name: /Log this set/i }).click();

  await expect(cableSquats.locator('.wkchip')).toHaveCount(1);
  await expect(page.locator('#ringTxt'), 'Rest-group sets should not inflate or reduce the chosen quest.').toHaveText('0/40 sets');

  await page.reload();
  await expect(page.getByLabel('Legs weekly role', { exact: true })).toHaveValue('rest');
  await expect(cableSquats.locator('.wkchip')).toHaveCount(1);
  await expect(page.locator('#ringTxt')).toHaveText('0/40 sets');
});

test('training mode visibly changes and persists the weekly quest target', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await expect(page.locator('#ringTxt')).toHaveText('0/50 sets');

  await page.locator('#tierSeg button[data-t="maintain"]').click();
  await expect(page.locator('#ringTxt')).toHaveText('0/38 sets');
  await expect(page.locator('#tierSummary')).toContainText(/Maintain.*38 quest sets/i);

  await page.reload();
  await expect(page.locator('#ringTxt')).toHaveText('0/38 sets');
  await expect(page.locator('#tierSeg button[data-t="maintain"]')).toHaveClass(/on/);
});

test('T-020 visible set removal recalculates statistics after reload', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await openFirstLogSheet(page);
  await fillSet(page, '10', '12.5');
  await page.getByRole('button', { name: /Log & add another/i }).click();
  await fillSet(page, '9', '15');
  await page.getByRole('button', { name: /Log this set/i }).click();
  await expect(loggedSetChips(page)).toHaveCount(2);

  await openStats(page);
  await expect(statValue(page, 'Set volume')).toHaveText('2');

  await page.locator('nav').getByRole('button', { name: /Week/i }).click();
  let removalPrompt = '';
  page.once('dialog', async (dialog) => {
    removalPrompt = dialog.message();
    await dialog.dismiss();
  });
  await loggedSetChips(page).first().locator('.x').click();
  await expect.poll(() => removalPrompt, {
    message: 'Direct set removal should explain the permanent data loss before deleting.',
  }).toMatch(/remove|delete/i);
  await expect(loggedSetChips(page)).toHaveCount(2);

  page.once('dialog', (dialog) => dialog.accept());
  await loggedSetChips(page).first().locator('.x').click();
  await expect(loggedSetChips(page)).toHaveCount(1);

  await openStats(page);
  await expect(statValue(page, 'Set volume')).toHaveText('1');
  await expect(statValue(page, 'Exercises')).toHaveText('1');

  await page.reload();
  await openStats(page);
  await expect(statValue(page, 'Set volume')).toHaveText('1');
});

test('MF-07 logged sets expose an edit flow that persists changed values', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');

  const editSet = page.getByRole('button', { name: /edit (logged )?set|modify set/i });
  await expect(editSet, 'MF-07: a logged set should have an accessible edit control.').toBeVisible();

  await editSet.first().click();
  await fillSet(page, '11', '15');
  await page.getByRole('button', { name: /Save set|Update set/i }).click();

  await expect(loggedSetChips(page).first()).toContainText(/11.*15kg/i);
  await page.reload();
  await expect(loggedSetChips(page).first()).toContainText(/11.*15kg/i);
});

test('T-010 completed workout sets can be edited from History and persist', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');
  await finishWorkout(page);
  await openHistory(page);

  const session = page.getByRole('button', { name: /Completed workout session/i });
  await session.click();
  const editSet = page.getByRole('button', { name: /Edit set 10 by 12\.5kg/i });
  await expect(editSet, 'T-010: completed workout details should expose an edit control for each set.').toBeVisible();

  await editSet.click();
  await fillSet(page, '11', '15');
  await page.getByRole('button', { name: /Save set|Update set/i }).click();
  await expect(page.locator('#histList')).toContainText(/11.*15kg/i);

  await page.reload();
  await openHistory(page);
  await page.getByRole('button', { name: /Completed workout session/i }).click();
  await expect(page.locator('#histList')).toContainText(/11.*15kg/i);
});

test('exercise editing and deletion are persisted without erasing logged history', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  const editedName = `Full Test Press ${Date.now()}`;
  await openLocalProfile(page, name);

  await page.locator('button[title="Edit"]').first().click();
  await expect(page.getByRole('heading', { name: /Edit exercise/i })).toBeVisible();
  await page.locator('#fName').fill(editedName);
  await page.getByRole('button', { name: /Save exercise/i }).click();
  await expect(page.getByText(editedName)).toBeVisible();

  await page.reload();
  await expect(page.locator('#weekList .exname', { hasText: editedName })).toBeVisible();

  await page.locator('.ex', { hasText: editedName }).locator('button[title="Edit"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Remove from program/i }).click();
  await expect(page.locator('#weekList .exname', { hasText: editedName })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#weekList .exname', { hasText: editedName })).toHaveCount(0);
});

test('local profile logout keeps profiles isolated and data recoverable', async ({ page }, testInfo) => {
  const profileA = profileName(testInfo, '_a');
  const profileB = profileName(testInfo, '_b');

  await openLocalProfile(page, profileA);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');
  await logout(page, profileA);

  await openLocalProfile(page, profileB);
  await expect(loggedSetChips(page)).toHaveCount(0);
  await openStats(page);
  await expect(statValue(page, 'Set volume')).toHaveText('0');
  await logout(page, profileB);

  await openLocalProfile(page, profileA);
  await expect(loggedSetChips(page)).toHaveCount(1);
  await openStats(page);
  await expect(statValue(page, 'Set volume')).toHaveText('1');
});

test('login persists across reload, logout relocks the app, and data survives re-open', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');

  await page.reload();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeHidden();
  await expect(loggedSetChips(page)).toHaveCount(1);

  await logout(page, name);
  await page.reload();
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start workout$/i })).toHaveCount(0);

  await openLocalProfile(page, name);
  await expect(loggedSetChips(page)).toHaveCount(1);
});

test('invalid structured import is rejected and preserves current visible data', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();

  await importJson(page, testInfo, 'invalid-structured-import.json', {
    schemaVersion: 3,
    exercises: 'not an array',
    sets: [{ id: 'bad-set', exId: 'missing-exercise', date: '2999-01-01', ts: 32503680000000, reps: '3.5', kg: -20 }],
    workouts: [{ id: 'bad-workout', status: 'completed', setIds: ['bad-set'], startedAt: 32503680000000, endedAt: 32503680600000 }],
  });

  await expect(page.locator('#toast')).toContainText(/Invalid file|Could not read file|future|invalid/i);
  await expect(loggedSetChips(page)).toHaveCount(1);

  await page.reload();
  await expect(loggedSetChips(page)).toHaveCount(1);
});

test('locked screen traps reverse tab, Escape, Enter, and pointer attempts inside the gate', async ({ page }) => {
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  await expect(page.locator('#gateProfile')).toBeFocused();

  for (const key of ['Shift+Tab', 'Shift+Tab', 'Tab', 'Escape', 'Enter']) {
    await page.keyboard.press(key);
    const insideGate = await page.evaluate(() => {
      const gate = document.getElementById('profileGate');
      return Boolean(gate && gate.contains(document.activeElement));
    });
    expect.soft(insideGate, `Focus should remain inside the profile gate after ${key}.`).toBe(true);
  }

  await page.mouse.click(24, 24);
  await expect(page.getByRole('heading', { name: gateHeading })).toBeVisible();
  await expect(page.locator('#dataSheet')).not.toHaveClass(/show/);
  await expect(page.getByRole('button', { name: /^Start workout$/i })).toHaveCount(0);
});

test('completed history sessions toggle details from the keyboard', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');
  await finishWorkout(page);
  await openHistory(page);

  const session = page.getByRole('button', { name: /Completed workout session/i }).first();
  await expect(session).toHaveAttribute('aria-expanded', 'false');
  await session.focus();
  await page.keyboard.press('Enter');
  await expect(session).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.day.session.open .day-body')).toContainText(/10.*12.5kg/i);

  await page.keyboard.press('Space');
  await expect(session).toHaveAttribute('aria-expanded', 'false');
});

test('mobile weekly quest keeps setup compact and filters on one row', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = profileName(testInfo);
  await openLocalProfile(page, name);

  const layout = await page.evaluate(() => {
    const height = (selector) => Math.round(document.querySelector(selector).getBoundingClientRect().height);
    const groupTops = [...document.querySelectorAll('#groupSeg button')]
      .map((button) => Math.round(button.getBoundingClientRect().top));
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroHeight: height('.quest-hero'),
      loadoutHeight: height('#questLoadout'),
      nextQuestHeight: height('.next-quest-card'),
      groupRows: new Set(groupTops).size,
    };
  });

  expect(layout.scrollWidth, 'Mobile dashboard must not overflow horizontally.').toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.heroHeight, 'Weekly hero should not dominate the phone viewport.').toBeLessThanOrEqual(205);
  expect(layout.loadoutHeight, 'The four weekly roles should fit in a compact 2x2 loadout.').toBeLessThanOrEqual(250);
  expect(layout.nextQuestHeight, 'Recommendations should remain a short actionable list.').toBeLessThanOrEqual(125);
  expect(layout.groupRows, 'Mobile grouping controls should stay on one row.').toBe(1);
});

test('mobile logging sheet keeps primary action visible and unobscured by toast', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await openFirstLogSheet(page);

  const primary = page.getByRole('button', { name: /Log this set/i });
  await expect(primary).toBeVisible();
  await expect(primary).toBeInViewport();

  const toast = page.locator('#toast.show');
  if (await visible(toast)) {
    const toastBox = await toast.boundingBox();
    const primaryBox = await primary.boundingBox();
    expect(toastBox, 'Visible toast should have measurable bounds.').toBeTruthy();
    expect(primaryBox, 'Primary logging action should have measurable bounds.').toBeTruthy();
    const overlaps =
      toastBox.x < primaryBox.x + primaryBox.width &&
      toastBox.x + toastBox.width > primaryBox.x &&
      toastBox.y < primaryBox.y + primaryBox.height &&
      toastBox.y + toastBox.height > primaryBox.y;
    expect(overlaps, 'Mobile toast should not cover the primary logging action.').toBe(false);
  }
});

test('offline reload keeps the app shell and local workout data available', async ({ page, context }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);
  await startWorkout(page);
  await logOneSet(page, '10', '12.5');

  const serviceWorkerSupported = await page.evaluate(() => 'serviceWorker' in navigator);
  expect(serviceWorkerSupported, 'Offline behavior requires service worker support in the test browser.').toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: gateHeading })).toBeHidden();
    await expect(page.getByRole('heading', { name: /^IronLog$/i })).toBeVisible();
    await expect(loggedSetChips(page)).toHaveCount(1);
    await openStats(page);
    await expect(statValue(page, 'Set volume')).toHaveText('1');
  } finally {
    await context.setOffline(false);
  }
});
