// E2E: public people directory page — list, add, edit, delete + picker integration
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

  // 2. filter chips work
  await page.locator('button:has-text("افراد خارجی")').first().click();
  await page.waitForTimeout(1200);
  const externalBadges = await page.locator('span:has-text("خارجی")').count();
  const internalLeft = await page.locator('button:has-text("عضو شرکت") >> nth=-1').count();
  check(`kind filter applied (external visible: ${externalBadges})`, externalBadges >= 2);

  // back to all
  await page.locator('button:has-text("همه")').first().click();
  await page.waitForTimeout(1000);

  // 3. add a new external person (employee CAN add — shared directory)
  await page.locator('button:has-text("فرد جدید")').click();
  await page.fill('input[placeholder*="نام و نام خانوادگی"]', "زائر تستی صفحه افراد");
  await page.fill('input[placeholder*="شرکت"]', "شرکت تست الف");
  await page.locator('button:has-text("افزودن")').last().click();
  await page.waitForTimeout(1500);
  const added = await page.locator('text=زائر تستی صفحه افراد').count();
  check("new person added by employee", added >= 1);

  // 4. edit that person
  for (const d of await page.locator("div.rounded-md.border").all()) {
    const t = await d.textContent().catch(() => "");
    if (t.includes("زائر تستی صفحه افراد")) {
      await d.locator('button[title="ویرایش"]').click();
      break;
    }
  }
  await page.waitForTimeout(600);
  const editInput = page.locator('input[placeholder*="نام و نام خانوادگی"]');
  await editInput.fill("زائر تستی ویرایش‌شده");
  await page.locator('button:has-text("ذخیره تغییرات")').last().click();
  await page.waitForTimeout(1500);
  const edited = await page.locator('text=زائر تستی ویرایش‌شده').count();
  check("person edited", edited >= 1);

  // 5. delete it
  page.once("dialog", (d) => d.accept());
  for (const d of await page.locator("div.rounded-md.border").all()) {
    const t = await d.textContent().catch(() => "");
    if (t.includes("زائر تستی ویرایش‌شده")) {
      await d.locator('button[title="حذف"]').click();
      break;
    }
  }
  await page.waitForTimeout(1500);
  const gone = await page.locator('text=زائر تستی ویرایش‌شده').count();
  check("person deleted", gone === 0);

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
