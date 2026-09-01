// E2E: public legal pages return 200 and show Persian titles.
const { chromium } = require("playwright");

const BASE = "http://localhost:3100";

const PAGES = [
  { path: "/privacy", titlePart: "حریم خصوصی", heading: "سیاست حریم خصوصی" },
  { path: "/terms", titlePart: "شرایط استفاده", heading: "شرایط استفاده" },
  { path: "/data-retention", titlePart: "نگهداری داده", heading: "نگهداری داده" },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const results = [];
  const check = (name, cond) => {
    results.push([name, !!cond]);
    if (!cond) console.error("FAIL |", name);
    else console.log("PASS |", name);
  };

  try {
    for (const { path, titlePart, heading } of PAGES) {
      const res = await page.request.get(`${BASE}${path}`);
      check(`${path} HTTP 200`, res.status() === 200);

      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      check(`${path} dir=rtl`, (await page.getAttribute("html", "dir")) === "rtl");
      check(`${path} page title`, (await page.title()).includes(titlePart));
      check(`${path} h1`, (await page.locator("h1").first().textContent())?.includes(heading) ?? false);
      check(`${path} footer legal links`, (await page.locator('[data-testid="legal-footer-links"]').count()) >= 1);
    }

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    check("landing privacy link", (await page.locator('footer a[href="/privacy"]').count()) >= 1);
    check("landing terms link", (await page.locator('footer a[href="/terms"]').count()) >= 1);

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    check("login legal footer", (await page.locator('[data-testid="legal-footer-links"]').count()) >= 1);
  } catch (e) {
    check(`exception: ${e.message}`, false);
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
