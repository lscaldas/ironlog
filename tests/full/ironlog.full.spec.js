const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

const gateHeading = /Open IronLog/i;

test('app shell cache-busts UI assets with the service-worker version', async () => {
  const index = fs.readFileSync('index.html', 'utf8');
  const serviceWorker = fs.readFileSync('sw.js', 'utf8');
  const init = fs.readFileSync('js/init.js', 'utf8');
  const version = serviceWorker.match(/ironlog-static-v(\d+)/)?.[1];

  expect(version, 'Service worker should expose a numeric app-shell version.').toBeTruthy();
  expect(index).toContain(`styles.css?v=${version}`);
  expect(index).toContain(`js/week.js?v=${version}`);
  expect(init).toContain(`register('./sw.js?v=${version}')`);
  expect(serviceWorker).toContain("fetch(event.request, {cache:'no-store'})");
});

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

test('weekly loadout picker shows once, hides deselected groups, and persists', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);

  const setup = page.locator('#weekSetup');
  await expect(setup, 'A fresh week should surface the loadout picker.').toBeVisible();
  await expect(page.getByRole('heading', { name: /Next quest/i })).toHaveCount(0);
  await expect(page.locator('#tierSeg')).toHaveCount(0);

  const cableSquats = page.locator('#weekList .ex', { hasText: 'Cable Squats' });
  await expect(cableSquats).toBeVisible();

  await setup.locator('.setup-chip', { hasText: 'Legs' }).click();
  await page.getByRole('button', { name: /Lock in this week/i }).click();

  await expect(setup, 'The picker should disappear after the weekly choice is locked in.').toBeHidden();
  await expect(page.locator('#weekFocusRow')).toBeVisible();
  await expect(cableSquats, 'Deselected Legs exercises should hide to keep the screen focused.').toHaveCount(0);
  await expect(page.locator('#mbalList .mrow'), 'Deselected muscle groups must leave the weekly decision surface.').toHaveCount(6);
  await expect(page.locator('#mbalList .mrow', { hasText: 'Quads' }), 'Deselected muscle bars should leave the decision surface.').toHaveCount(0);
  await expect(page.locator('#weekList .ex', { hasText: 'Pullups' })).toBeVisible();

  await page.reload();
  await expect(page.locator('#weekSetup'), 'The weekly choice should stick — no picker again this week.').toBeHidden();
  await expect(page.locator('#weekList .ex', { hasText: 'Cable Squats' })).toHaveCount(0);

  await page.locator('#weekFocusRow').getByRole('button', { name: /Change/i }).click();
  await expect(page.locator('#weekSetup'), 'Change should reopen the picker.').toBeVisible();
});

test('muscle bars stack tier lives, stay central, and exercises show per-set contributions', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  await openLocalProfile(page, name);

  await expect(page.locator('.quest-hero'), 'The redundant mission summary should not compete with the muscle bars.').toHaveCount(0);
  await expect(page.locator('#mbalCard'), 'Muscle bars are the central decision surface.').toBeVisible();
  await expect(page.locator('#mbalCard .tier-legend span')).toHaveText(['Maintain', 'Build', 'Beast']);
  const tierColors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return ['--tier-maintain', '--tier-build', '--tier-beast'].map((name) => root.getPropertyValue(name).trim());
  });
  expect(tierColors, 'Tiers share one purple family that brightens each phase.').toEqual([
    '#6b4fd8',
    '#a98bff',
    '#ddd0ff',
  ]);
  const pullups = page.locator('#weekList .ex', { hasText: 'Pullups' });
  await expect(pullups.locator('.contrib', { hasText: /\+1 Back/i }), 'Each exercise must state what one set feeds into the bars.').toBeVisible();
  await expect(pullups.locator('.contrib', { hasText: /Biceps/i })).toBeVisible();

  const backRow = page.locator('#mbalList .mrow', { hasText: 'Back' }).first();
  await expect(backRow.locator('.mseg'), 'Each bar is split into three boss-HP sub-bars.').toHaveCount(3);
  await expect(backRow.locator('.val'), 'The current value stays centered on the bar.').toHaveText('0');
  await expect(backRow.locator('.mseg.full')).toHaveCount(0);
  await expect(backRow.locator('.mseg.locked'), 'Later phases start locked.').toHaveCount(2);

  await startWorkout(page);
  for (let i = 0; i < 4; i += 1) {
    await pullups.locator('button[title="Log set"]').click();
    await fillSet(page, String(8 + i), '0');
    await page.getByRole('button', { name: /Log this set/i }).click();
    await expect(pullups.locator('.wkchip')).toHaveCount(i + 1);
  }

  await expect(backRow.locator('.val')).toHaveText('4');
  await expect(backRow.locator('.mseg.full'), 'Clearing maintain should complete the first sub-bar.').toHaveCount(1);
  await expect(backRow.locator('.mseg.locked'), 'Clearing maintain should unlock the build sub-bar.').toHaveCount(1);

  await page.reload();
  await expect(page.locator('#mbalList .mrow', { hasText: 'Back' }).first().locator('.val')).toHaveText('4');
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

test('exercise cards can adopt an inferred name and show only the three latest sets', async ({ page }, testInfo) => {
  const name = profileName(testInfo);
  const customName = `My Cable Rows ${Date.now()}`;
  await openLocalProfile(page, name);

  await page.locator('button[title="Edit"]').first().click();
  await page.locator('#fName').fill(customName);
  await page.getByRole('button', { name: /Save exercise/i }).click();

  let card = page.locator('.ex', { hasText: customName });
  await expect(card.locator('.match-note')).toContainText(/Counting as Cable Rows/i);
  const correctName = card.getByRole('button', { name: /Use Cable Rows as exercise name/i });
  await expect(correctName).toBeVisible();
  await correctName.click();

  card = page.locator('.ex', { has: page.locator('.exname', { hasText: /^Cable Rows$/ }) });
  await expect(card.locator('.exname')).toHaveText('Cable Rows');
  await expect(card.locator('.match-note')).toHaveCount(0);
  await expect(card.getByRole('button', { name: /Use .* as exercise name/i })).toHaveCount(0);

  await startWorkout(page);
  for (let reps = 8; reps <= 11; reps += 1) {
    await card.locator('button[title="Log set"]').click();
    await fillSet(page, String(reps), '20');
    await page.getByRole('button', { name: /Log this set/i }).click();
  }

  await expect(card.locator('.wkchip')).toHaveCount(3);
  await expect(card.locator('.wkchips')).not.toContainText('8×20kg');
  await expect(card.locator('.wkchips')).toContainText('9×20kg');
  await expect(card.locator('.wkchips')).toContainText('11×20kg');
  await expect(card.locator('.exsub')).not.toContainText(/Last 11×20kg/i);
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
    const bars = document.querySelector('#mbalCard');
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroCount: document.querySelectorAll('.quest-hero').length,
      setupHeight: height('#weekSetup'),
      barsVisible: Boolean(bars) && getComputedStyle(bars).display !== 'none',
      barsTop: Math.round(bars.getBoundingClientRect().top),
      groupRows: new Set(groupTops).size,
    };
  });

  expect(layout.scrollWidth, 'Mobile dashboard must not overflow horizontally.').toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.heroCount, 'The redundant mission hero should be removed on mobile too.').toBe(0);
  expect(layout.setupHeight, 'The weekly loadout picker should stay compact on a phone.').toBeLessThanOrEqual(300);
  expect(layout.barsVisible, 'Muscle bars are the core mechanic and must stay visible on mobile.').toBe(true);
  expect(layout.barsTop, 'Removing the hero should bring the core mechanic into the first phone viewport.').toBeLessThan(650);
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
