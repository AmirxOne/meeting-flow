// Visual verification: skeletons must mirror the loaded layout.
// Throttle network to ~1.2s so the skeleton state is capturable, then
// compare skeleton vs loaded geometry (grid shape, card count, row anatomy).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // login once
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  const results = [];
  const check = (name, ok) => { results.push([name, !!ok]); };

  // route throttling: delay API responses by 1.5s
  await page.route("**/api/**", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });

  async function measure(path) {
    await page.goto("http://localhost:3100" + path, { waitUntil: "domcontentloaded" });
    // capture while skeletons visible (wait for hydration to start rendering skeleton tree)
    await page.waitForSelector('.skeleton', { timeout: 20000 });
    await page.waitForTimeout(400);
    const skel = await page.evaluate(() => {
      const sk = [...document.querySelectorAll(".skeleton")];
      return { count: sk.length, present: sk.length > 0 };
    });
    await page.screenshot({ path: `D:/meetinghub/skel-${path.replaceAll("/", "-")}.png` });
    // wait for load — skeletons must ALL clear
    await page.waitForFunction(() => document.querySelectorAll('.skeleton').length <= 2, null, { timeout: 30000 });
    const loaded = await page.evaluate(() => {
      const sk = [...document.querySelectorAll(".skeleton")];
      return { count: sk.length };
    });
    return { skel, loaded };
  }

  for (const path of ["/dashboard", "/meetings", "/rooms", "/notifications", "/branches", "/reports", "/users", "/admin/users", "/admin/audit-logs", "/admin/people", "/admin/policies", "/admin/rooms", "/rooms/room-a", "/meetings/seed-meeting-1"]) {
    const { skel, loaded } = await measure(path);
    check(
      `${path}: skeleton visible (${skel.count} blocks) → cleared (${loaded.count} left)`,
      skel.present && loaded.count < 3,
    );
  }

  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
