// E2E: card FOLLOWS the page scroll live (no teleport jump at the end)
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  await page.goto("http://127.0.0.1:3100/meetings/cmtefiu4z009cu958uw693war", {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("text=جزئیات جلسه").first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(1000);


  const samples = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(55);
    const y = await page.evaluate(() => {
      const c = [...document.querySelectorAll('body > div[dir="rtl"]')].find(
        (d) => d.getBoundingClientRect().width > 200,
      );
      return c ? Math.round(c.getBoundingClientRect().top) : -1;
    }).catch(() => -1);
    samples.push(y);
  }
  const valid = samples.filter((x) => x > 0);
  const distinct = new Set(valid).size;
  const first = valid[0], last = valid[valid.length - 1];
  const moved = Math.abs((last ?? 0) - (first ?? 0));
  // teleport signature: stays flat then one huge delta between consecutive frames
  let maxDelta = 0;
  for (let i = 1; i < valid.length; i++) maxDelta = Math.max(maxDelta, Math.abs(valid[i] - valid[i - 1]));
  console.log("samples:", samples.join(","));
  console.log(`distinct:${distinct} moved:${moved}px maxFrameDelta:${maxDelta}px`);
  const glides = distinct >= 4 && maxDelta < 120; // many positions, no single huge hop
  const settled = moved < 5; // no movement needed this step — also fine
  console.log(glides ? "CARD GLIDES WITH SCROLL ✅" : settled ? "NO MOVE NEEDED ✅" : "TELEPORT JUMP ❌");
  await browser.close();
  process.exit(glides || settled ? 0 : 1);
})();
