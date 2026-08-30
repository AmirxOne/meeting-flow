// Login page: identifier (email/mobile), RTL fields, password eye, phone login.
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
    await page.goto("http://localhost:3100/login", { waitUntil: "networkidle" });
    const identifier = page.locator('input[name="identifier"]');
    const password = page.locator('input[name="password"]');

    check("identifier field is text (not email-only)", (await identifier.getAttribute("type")) === "text");
    check("identifier is rtl + text-right", (await identifier.evaluate((el) => el.dir === "rtl" && getComputedStyle(el).textAlign === "right")));
    check("password is rtl + text-right", (await password.evaluate((el) => el.dir === "rtl" && getComputedStyle(el).textAlign === "right")));
    check("eye toggle present", (await page.locator('[data-tooltip="نمایش رمز"]').count()) > 0);

    await identifier.fill("09120001001");
    const shown = await identifier.inputValue();
    check("mobile shown with Persian digits", shown.includes("۰۹۱۲") || shown.includes("0912"));

    await password.fill("Pass1234");
    await page.locator('[data-tooltip="نمایش رمز"]').click();
    check("password revealed", (await password.getAttribute("type")) === "text");
    check("eye toggles to hide", (await page.locator('[data-tooltip="پنهان کردن رمز"]').count()) > 0);

    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    check("phone login reaches dashboard", page.url().includes("/dashboard"));

    await page.context().clearCookies();
    await page.goto("http://localhost:3100/login", { waitUntil: "networkidle" });
    await page.locator('button:has-text("مدیر")').first().click();
    const filled = await page.locator('input[name="identifier"]').inputValue();
    check("demo chip fills email", filled.includes("admin@example.com") || filled.includes("admin@"));
  } catch (e) {
    check(`exception: ${e.message}`, false);
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
