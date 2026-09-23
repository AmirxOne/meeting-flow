// E2E: topic delete uses a professional modal instead of window.confirm
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)));
  let nativeConfirmShown = false;
  page.on('dialog', async d => { nativeConfirmShown = true; await d.dismiss(); });

  const r = await fetch('http://127.0.0.1:3100/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }),
  });
  await ctx.addCookies(r.headers.getSetCookie().map(c => {
    const [kv] = c.split(';'); const [name, ...rest] = kv.split('=');
    return { name, value: rest.join('='), domain: '127.0.0.1', path: '/' };
  }));

  await page.goto('http://127.0.0.1:3100/meetings/cmudwad6u000eu960ia57ayqo', { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // open the topics tab
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'موضوعات مطرح‌شده'); if (b) b.click(); });
  await page.waitForTimeout(1500);

  const out = {};

  // click the first topic's delete button
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="حذف موضوع"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(700);

  out.nativeConfirmUsed = nativeConfirmShown;
  out.modal = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const txt = dlg.innerText;
    return {
      title: txt.includes('حذف موضوع'),
      showsTopicTitle: txt.includes('آمار استفاده') || txt.includes('بازخورد') || txt.includes('برنامه انتشار'),
      irreversible: txt.includes('قابل بازگشت نیست'),
      hasCancel: Boolean([...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'انصراف')),
      hasConfirm: Boolean([...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'حذف کن')),
      portaled: dlg.closest('body') !== null,
    };
  });

  // cancel keeps the topic
  if (out.modal) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'انصراف'); if (b) b.click(); });
    await page.waitForTimeout(500);
    out.topicSurvivesCancel = await page.evaluate(() => document.body.innerText.includes('آمار استفاده نسخه فعلی'));
  }

  out.jsErrors = errors.length;
  console.log(JSON.stringify(out, null, 1));
  const ok = !out.nativeConfirmUsed && out.modal && out.modal.title && out.modal.showsTopicTitle && out.modal.irreversible
    && out.modal.hasCancel && out.modal.hasConfirm && out.topicSurvivesCancel && out.jsErrors === 0;
  console.log(ok ? 'DELETE MODAL ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
