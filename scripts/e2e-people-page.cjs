// E2E: public people directory page — list, add, edit, delete + picker integration
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const UNIQ = Date.now() % 100000;
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "ali@example.com", password: "Pass1234" }, // regular employee
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // 1. /people renders with cards
  await page.goto("http://localhost:3100/people", { waitUntil: "domcontentloaded" });
  await page.locator("text=عضو شرکت").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  const cards = await page.locator("text=عضو شرکت").count();
  check(`directory cards render (${cards} internal badges)`, cards >= 5);

  // 2. filter dropdown works (open نوع → افراد خارجی)
  await page.locator('button[aria-haspopup="listbox"]', { hasText: 'نوع' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('ul[role="listbox"] li', { hasText: 'افراد خارجی' }).first().click();
  await page.waitForTimeout(1200);
  const externalBadges = await page.locator('span:has-text("خارجی")').count();
  const internalLeft = await page.locator('button:has-text("عضو شرکت") >> nth=-1').count();
  check(`kind filter applied (external visible: ${externalBadges})`, externalBadges >= 2);

  // back to all
  await page.locator('button[aria-haspopup="listbox"]', { hasText: 'نوع' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('ul[role="listbox"] li', { hasText: 'همه' }).first().click();
  await page.waitForTimeout(1000);

  // 3. add a new external person (employee CAN add — shared directory)
  await page.locator('button:has-text("فرد جدید")').click();
  const dlg = page.locator('[role="dialog"]');
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('input[placeholder*="نام و نام خانوادگی"]').fill(`${UNIQ} زائر تستی`);
  await dlg.locator('input[placeholder*="شرکت"]').fill("شرکت تست الف");
  await dlg.locator('button:has-text("افزودن")').last().click();
  await page.waitForTimeout(1500);
  const added = await page.locator('tbody tr', { hasText: `${UNIQ} زائر تستی` }).count();
  check("new person added by employee", added >= 1);

  // 4. edit that person
  {
    const row = page.locator('tbody tr', { hasText: `${UNIQ} زائر تستی` }).first();
    await row.waitFor({ timeout: 15000 });
    await row.locator('button[title="ویرایش"]').click();
  }
  const editDlg = page.locator('[role="dialog"]');
  await editDlg.waitFor({ timeout: 15000 });
  await editDlg.locator('input[placeholder*="نام و نام خانوادگی"]').fill(`${UNIQ} renamed`);
  await editDlg.locator('button:has-text("ذخیره تغییرات")').last().click();
  await page.waitForTimeout(2000);
  const edited = await page.locator('tbody tr', { hasText: `${UNIQ} renamed` }).count();
  check('person edited (renamed)', edited >= 1);

  // 5. delete it
  page.once('dialog', (d) => d.accept());
  {
    const row = page.locator('tbody tr', { hasText: `${UNIQ} renamed` }).first();
    await row.waitFor({ timeout: 15000 });
    await row.locator('button[title="حذف"]').click();
  }
  await page.waitForTimeout(2000);
  const gone = await page.locator('tbody tr', { hasText: `${UNIQ} renamed` }).count();
  check('person deleted', gone === 0);

  // 6. sidebar link visible for employee
  await page.goto("http://localhost:3100/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const navLink = await page.locator('a[href="/people"]').count();
  check(`sidebar افراد link present (${navLink})`, navLink >= 1);

  let pass = 0;
  for (const [nm, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${nm}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
