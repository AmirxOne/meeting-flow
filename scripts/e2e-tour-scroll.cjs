// E2E: tour auto-scrolls to off-screen targets (meeting detail step 3)
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) {
    console.log("login:", res.status());
    process.exit(1);
  }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  await page.goto("http://localhost:3100/meetings/cmtefiu4z009cu958uw693war", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // auto-start tour should be visible now
  await page.locator("text=جزئیات جلسه").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  console.log("step1 shown:", (await page.locator("text=جزئیات جلسه").count()) >= 1 ? "✅" : "❌");

  // advance to step 3 (صورتجلسه) — target far down the page
  await page.locator("button:has-text('بعدی')").last().click();
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('بعدی')").last().click();
  await page.waitForTimeout(1800);

  const info = await page.evaluate(() => {
    const card = document.querySelector("body > div[dir=rtl]");
    const target = document.querySelector('[data-tour="meeting-minutes"]');
    const cr = card?.getBoundingClientRect();
    const tr = target?.getBoundingClientRect();
    return {
      step3Title: !!card?.textContent.includes("صورتجلسه"),
      targetOnScreen: tr ? tr.top > 0 && tr.bottom < innerHeight : false,
      scrollY: Math.round(scrollY),
      docH: document.body.scrollHeight,
      cardPos: cr ? [Math.round(cr.x), Math.round(cr.y)] : null,
    };
  });
  console.log("step3:", JSON.stringify(info));
  const ok = info.step3Title && info.targetOnScreen && info.scrollY > 100;
  console.log(ok ? "AUTO-SCROLL WORKS ✅" : "AUTO-SCROLL FAILED ❌");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
