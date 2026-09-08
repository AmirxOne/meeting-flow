// debug: why doesn't the tour scroll to step-3 target?
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => console.log("PAGE:", m.text().slice(0, 130)));

  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  await page.goto("http://localhost:3100/meetings/cmtefiu4z009cu958uw693war", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("text=جزئیات جلسه").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);

  // step 2
  await page.locator("button:has-text('بعدی')").last().click();
  await page.waitForTimeout(1000);
  // step 3 — instrument BEFORE clicking next
  await page.evaluate(() => {
    window.__scrollEvents = [];
    window.addEventListener("scroll", () => window.__scrollEvents.push(Math.round(scrollY)), true);
    const t = document.querySelector('[data-tour="meeting-minutes"]');
    window.__targetExists = !!t;
    if (t) {
      const r = t.getBoundingClientRect();
      window.__targetPos = { top: Math.round(r.top), bottom: Math.round(r.bottom) };
    }
  });
  await page.locator("button:has-text('بعدی')").last().click();
  await page.waitForTimeout(2200);
  const info = await page.evaluate(() => ({
    targetExists: window.__targetExists,
    targetPosBefore: window.__targetPos,
    scrollEvents: window.__scrollEvents,
    scrollYNow: Math.round(scrollY),
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
  }));
  console.log("DEBUG:", JSON.stringify(info));
  await browser.close();
})();
