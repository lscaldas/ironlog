const {test,expect}=require('@playwright/test');

test('profile button shows local, live, syncing, offline, and sync issue states',async({page,context})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await page.locator('#gateProfile').fill('mode_'+Date.now());
  await page.locator('#gateLocalBtn').click();
  const mode=page.locator('#profileSyncMode');
  await expect(mode).toHaveText('Local');
  await expect(page.locator('#profilePill')).toHaveAttribute('data-mode','local');
  await page.evaluate(()=>{
    CLOUD.user={uid:'test-user',email:'test@example.com'};
    CLOUD.unlocked=true;
    updateCloudUI();
  });
  await expect(mode).toHaveText('Live');
  await page.evaluate(()=>queueCloudSave(60000));
  await expect(mode).toHaveText('Syncing');
  await context.setOffline(true);
  await expect(mode).toHaveText('Offline');
  await context.setOffline(false);
  await expect(mode).toHaveText('Syncing');
  await page.evaluate(()=>{
    clearTimeout(CLOUD.timer); CLOUD.timer=null;
    CLOUD.syncError=true; updateCloudUI();
  });
  await expect(mode).toHaveText('Sync issue');
  expect(await page.locator('#profilePill').evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
});
