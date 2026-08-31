// Public landing: professional copy, RTL, CTAs to login.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => {
    results.push([name, !!cond]);
    if (!cond) console.error("FAIL |", name);
    else console.log("PASS |", name);
  };

  try {
    await page.context().clearCookies();
    await page.goto("http://localhost:3100/", { waitUntil: "networkidle" });

    check("title مهرسا", (await page.title()).includes("مهرسا"));
    check("dir=rtl", (await page.getAttribute("html", "dir")) === "rtl");
    check("hero heading", (await page.locator("h1").first().textContent())?.includes("زمان سازمان") ?? false);
    check("features section", (await page.locator("#features").count()) === 1);
    check("workflow section", (await page.locator("#workflow").count()) === 1);
    check("trust section", (await page.locator("#trust").count()) === 1);
    check("login CTA", (await page.locator('a[href="/login"]').count()) >= 2);

    await page.locator('header a[href="/login"]').click();
    await page.waitForURL("**/login", { timeout: 15000 });
    check("header CTA opens login", page.url().includes("/login"));
  } catch (e) {
    check(`exception: ${e.message}`, false);
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
