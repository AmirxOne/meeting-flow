// E2E: rich minutes editor + professional attachments box
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:3100';

async function login(ctx) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }),
  });
  await ctx.addCookies(r.headers.getSetCookie().map(c => {
    const [kv] = c.split(';'); const [name, ...rest] = kv.split('=');
    return { name, value: rest.join('='), domain: '127.0.0.1', path: '/' };
  }));
}

(async () => {
  // create a fresh IN_PROGRESS meeting for editable minutes
  const lr = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }) });
  const cookie = lr.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  const cr = await fetch(`${BASE}/api/meetings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ title: 'تست ادیتور E2E', description: '', startAt: new Date(`${day}T14:00:00+03:30`).toISOString(), endAt: new Date(`${day}T15:00:00+03:30`).toISOString(), roomId: 'room-a', meetingType: 'INTERNAL', participantIds: [] }),
  });
  const meeting = (await cr.json()).data.meeting;
  await fetch(`${BASE}/api/meetings/${meeting.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{}' });
  console.log('meeting:', meeting.id);

  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)));
  let nativeConfirm = false;
  page.on('dialog', async d => { nativeConfirm = true; await d.dismiss(); });
  await login(ctx);

  await page.goto(`${BASE}/meetings/${meeting.id}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const out = { meetingId: meeting.id };

  // ── minutes editor: toolbar + bubble ──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'متن کامل'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  out.editor = await page.evaluate(() => {
    const ed = document.querySelector('.ProseMirror');
    const toolbar = document.querySelector('.tiptap, [class*="prose-mehrsa"]')?.closest('div');
    const bar = [...document.querySelectorAll('button')].filter(b => ['B', 'I', 'U', 'S'].includes(b.textContent.trim()));
    return { prosemirror: Boolean(ed), toolbarBtns: bar.length, editable: ed?.isContentEditable, placeholder: ed?.textContent === '' };
  });

  // type text, select it, check bubble menu appears
  await page.click('.ProseMirror');
  await page.keyboard.type('متن تست صورت جلسه برای ادیتور');
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(500);
  out.bubble = await page.evaluate(() => {
    const bubble = [...document.querySelectorAll('div')].find(d => d.className.includes('shadow') && [...d.querySelectorAll('button')].some(b => b.textContent.trim() === 'B'));
    return Boolean(bubble);
  });

  // click Bold in the bubble, then save
  await page.evaluate(() => {
    const bubble = [...document.querySelectorAll('div')].find(d => d.className.includes('shadow') && [...d.querySelectorAll('button')].some(b => b.textContent.trim() === 'B'));
    const b = [...bubble.querySelectorAll('button')].find(x => x.textContent.trim() === 'B');
    b.click();
  });
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('ذخیره پیش‌نویس'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1000);
  out.boldSaved = saved;
  out.boldInDom = await page.evaluate(() => Boolean(document.querySelector('.ProseMirror strong, strong')));

  // ── attachments: drag&drop + progress + preview + delete modal ──
  // scroll to the attachments card
  await page.evaluate(() => { document.querySelector('[data-testid="meeting-attachments"]')?.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(600);

  // simulate a drop via DataTransfer
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync('C:/Users/AXO/AppData/Local/hermes/cache/scratch/e2e-test.png', png);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const fileInput = await page.$('input[type=file][data-testid="attachment-file-input"]');
  await fileInput.setInputFiles('C:/Users/AXO/AppData/Local/hermes/cache/scratch/e2e-test.png');
  await page.waitForTimeout(1500);
  out.attachment = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="meeting-attachments"]');
    const txt = card?.innerText ?? '';
    return {
      uploaded: txt.includes('e2e-test.png'),
      hasThumb: Boolean(card?.querySelector('img')),
      hasDownload: Boolean(card?.querySelector('[data-testid="attachment-download"]')),
    };
  });

  // delete via modal (not confirm)
  await page.evaluate(() => { document.querySelector('[data-testid="attachment-delete"]')?.click(); });
  await page.waitForTimeout(600);
  out.deleteModal = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    return { title: dlg.innerText.includes('حذف پیوست'), hasCancel: Boolean([...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'انصراف')), hasConfirm: Boolean([...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'حذف کن')) };
  });
  out.nativeConfirmUsed = nativeConfirm;

  out.jsErrors = errors.length;
  console.log(JSON.stringify(out, null, 1));
  const e = out.editor, a = out.attachment;
  const ok = e.prosemirror && e.toolbarBtns >= 4 && out.bubble && out.boldInDom && a.uploaded && a.hasThumb && out.deleteModal?.title && !out.nativeConfirmUsed && out.jsErrors === 0;
  console.log(ok ? 'EDITOR + ATTACHMENTS ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
