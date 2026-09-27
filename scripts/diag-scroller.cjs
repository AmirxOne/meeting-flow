// diag: کدام عنصر واقعاً اسکرول می‌خورد؟
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 500 } });
  await p.goto('http://localhost:3100/login', { waitUntil: 'networkidle', timeout: 90000 });
  await p.fill('#login-identifier', 'admin@example.com');
  await p.fill('#login-password', 'Pass1234');
  await p.click('button[type=submit]');
  await p.waitForURL('**/dashboard', { timeout: 90000 });
  await p.goto('http://localhost:3100/users', { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(4000);
  const list = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 30 && el.clientHeight > 150) {
        out.push(`${el.tagName} sh=${el.scrollHeight} ch=${el.clientHeight} cls=${(el.className || '').toString().slice(0, 50)}`);
      }
    });
    out.push(`DOC sh=${document.documentElement.scrollHeight} ch=${document.documentElement.clientHeight} bodySh=${document.body.scrollHeight}`);
    return out;
  });
  console.log(list.join('\n'));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
