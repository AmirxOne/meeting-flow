// E2E: org setup wizard — full flow on empty DB (E2E_ORG_SETUP=1) or redirect when seeded.
const { chromium } = require("playwright");

const BASE = "http://localhost:3100";
const RUN_FULL = process.env.E2E_ORG_SETUP === "1";

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];
  const check = (name, cond) => {
    results.push([name, !!cond]);
    if (!cond) console.error("FAIL |", name);
    else console.log("PASS |", name);
  };

  try {
    const statusRes = await page.request.get(`${BASE}/api/public/setup-status`);
    const statusBody = await statusRes.json();
    const needsSetup = statusBody?.data?.needsSetup === true;
    check("setup-status API 200", statusRes.status() === 200);

    if (RUN_FULL && needsSetup) {
      await page.goto(`${BASE}/start`, { waitUntil: "domcontentloaded" });
      check("start page title", (await page.locator("h1").first().textContent())?.includes("شروع") ?? false);
      check("start dir=rtl", (await page.getAttribute("html", "dir")) === "rtl");

      const suffix = Date.now().toString(36);
      await page.fill('[data-testid="setup-org-name"]', `شرکت E2E ${suffix}`);
      await page.click('[data-testid="setup-next"]');
      await page.fill('[data-testid="setup-admin-name"]', "مدیر E2E");
      await page.fill('[data-testid="setup-admin-email"]', `e2e-${suffix}@example.com`);
      await page.fill('[data-testid="setup-admin-password"]', "Pass1234");
      await page.click('[data-testid="setup-next"]');
      await page.fill('[data-testid="setup-branch-name"]', "شعبه مرکزی");
      await page.fill('[data-testid="setup-room-name"]', "اتاق A");
      await page.fill('[data-testid="setup-room-capacity"]', "10");
      await page.click('[data-testid="setup-submit"]');
      await page.waitForURL("**/dashboard**", { timeout: 30000 });
      check("redirects to dashboard after setup", page.url().includes("/dashboard"));
    } else if (RUN_FULL && !needsSetup) {
      console.log("SKIP | full setup flow — DB already has organizations (run on empty DB)");
    } else {
      console.log("SKIP | full setup flow — set E2E_ORG_SETUP=1 with empty DB to run");
    }

    if (!needsSetup) {
      await page.goto(`${BASE}/start`, { waitUntil: "domcontentloaded" });
      await page.waitForURL("**/login**", { timeout: 10000 });
      check("start redirects to login when seeded", page.url().includes("/login"));
    }
  } catch (e) {
    check(`exception: ${e.message}`, false);
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
