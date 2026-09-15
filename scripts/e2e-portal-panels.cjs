// E2E: dropdown/date-picker panels are NOT clipped — they render to body, visible over overflow boxes
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  const checks = {};

  // A) Select inside a modal (classic clip case): meetings/new has Selects; open it
  await page.goto("http://127.0.0.1:3100/meetings/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  // open the first Select (شعبه/نوع)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /شمسی|میلادی|INTERNAL|داخلی|شعبه/.test(b.textContent || "") && b.closest(".relative"));
    // fallback: first custom select trigger — button followed by chevron
    const cand = btn || document.querySelector(".relative > button");
    cand && cand.click();
  });
  await page.waitForTimeout(700);
  checks.selectPortal = await page.evaluate(() => {
    const list = document.querySelector('[role="listbox"]');
    if (!list) return { open: false };
    const r = list.getBoundingClientRect();
    return {
      open: true,
      inBody: !!list.closest("body"),
      visible: r.width > 0 && r.bottom <= window.innerHeight + 200,
    };
  });

  // B) JalaliDatePicker on /meeting-requests/queue schedule form (inside a Card)
  await page.goto("http://127.0.0.1:3100/meeting-requests/queue", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  const dpOpened = await page.evaluate(() => {
    const p = [...document.querySelectorAll("p.font-bold")].find((el) => el.textContent.includes("صف تست") || el.textContent.includes("تست"));
    if (!p) return false;
    let card = p.parentElement; while (card && card.querySelectorAll("button").length === 0) card = card.parentElement;
    const btn = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("زمان‌بندی"));
    btn && btn.click();
    return true;
  });
  await page.waitForTimeout(900);
  if (dpOpened) {
    await page.evaluate(() => {
      // click the date field inside the schedule form
      const lbl = [...document.querySelectorAll("label")].find((el) => el.textContent.trim() === "تاریخ");
      if (lbl) lbl.parentElement.querySelector("button")?.click();
    });
    await page.waitForTimeout(700);
    checks.datePickerPortal = await page.evaluate(() => {
      const panels = [...document.querySelectorAll("body > div")].filter((d) => d.textContent.includes("امروز"));
      const cal = panels.find((d) => d.querySelector("button") && d.getBoundingClientRect().width > 200);
      if (!cal) return { open: false };
      const r = cal.getBoundingClientRect();
      return { open: true, inBody: cal.parentElement === document.body, w: Math.round(r.width) };
    });
  }

  console.log(JSON.stringify(checks, null, 1));
  const ok = checks.selectPortal?.open && checks.selectPortal?.inBody && checks.datePickerPortal?.open && checks.datePickerPortal?.inBody;
  console.log(ok ? "PORTAL PANELS — NO CLIP ✅" : "CHECK RESULTS ABOVE");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
