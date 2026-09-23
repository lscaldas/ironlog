const {test,expect}=require('@playwright/test');

test('profile button shows local, live, syncing, offline, and sync issue states',async({page,context})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await page.locator('#gateProfile').fill(`mode_${Date.now()}`);
  await page.locator('#gateLocalBtn').click();
  const mode=page.locator('#profileSyncMode');
  await expect(mode).toHaveText('Local');
  await expect(page.locator('#profilePill')).toHaveAttribute('data-mode','local');

  await page.evaluate(()=>{
    window.IRONLOG_CLOUD={supabaseUrl:'https://example.invalid',supabaseAnonKey:'test'};
    CLOUD.pin='1234'; CLOUD.unlocked=true; updateCloudUI();
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
  const fits=await page.locator('#profilePill').evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth);
  expect(fits).toBe(true);

  await page.evaluate(()=>rememberSession('cloud'));
  await page.reload();
  await expect(mode).toHaveText('Local');
});
