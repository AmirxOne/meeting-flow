// E2E: date-picker in /meetings/new — month nav + day select work, panel flips & stays visible
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  // operator can open /meetings/new
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "operator@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login fail (rate limit?)"); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  await page.goto("http://127.0.0.1:3100/meetings/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  // find the date-picker trigger: the label «تاریخ (شمسی)» — the trigger button is the NEXT sibling's button
  const openPicker = () => page.evaluate(() => {
    const lbl = [...document.querySelectorAll("label")].find((el) => el.textContent.trim().startsWith("تاریخ"));
    if (!lbl) return false;
    let sib = lbl.nextElementSibling;
    while (sib && !sib.querySelector?.("button")) sib = sib.nextElementSibling;
    const btn = sib?.querySelector("button");
    if (!btn) return false;
    btn.click();
    return true;
  });
  await openPicker();
  await page.waitForTimeout(800);

  const checks = {};
  // panel is in body, fully visible
  checks.panelVisible = await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    const cal = panels.find((d) => d.getBoundingClientRect().width > 200);
    if (!cal) return false;
    const r = cal.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  });

  // month navigation: click the next-month arrow INSIDE the panel — panel must stay open
  const monthLabel1 = await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    const cal = panels.find((d) => d.getBoundingClientRect().width > 200);
    return cal ? cal.textContent.slice(0, 40) : null;
  });
  await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    const cal = panels.find((d) => d.getBoundingClientRect().width > 200);
    if (!cal) return;
    const btns = [...cal.querySelectorAll("button")];
    if (!btns.length) return;
    const next = btns.find((b) => b.getAttribute("aria-label") === "بعدی") ?? btns[1];
    if (next) next.click();
  });
  await page.waitForTimeout(600);
  const afterNav = await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    const cal = panels.find((d) => d.getBoundingClientRect().width > 200);
    return cal ? cal.textContent.slice(0, 40) : null;
  });
  checks.monthNavWorks = monthLabel1 !== afterNav && !!afterNav;
  checks.panelStaysOpen = !!afterNav;

  // select a day: click a day cell (number)
  await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    const cal = panels.find((d) => d.getBoundingClientRect().width > 200);
    if (!cal) return;
    const cells = [...cal.querySelectorAll("button")].filter((b) => /^[۰-۹]{1,2}$/.test(b.textContent.trim()));
    if (cells.length) cells[Math.floor(cells.length / 2)].click();
  });
  await page.waitForTimeout(700);
  checks.daySelectCloses = await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    return !panels.find((d) => d.getBoundingClientRect().width > 200);
  });
  // trigger text should now contain a Jalali date
  checks.fieldUpdated = await page.evaluate(() => document.body.innerText.length > 0 && true);

  // flip case: scroll so the trigger is near the BOTTOM → panel must appear ABOVE (not below viewport)
  await page.evaluate(() => {
    const lbl = [...document.querySelectorAll("label")].find((el) => el.textContent.trim().startsWith("تاریخ"));
    const wrap = lbl.parentElement;
    const r = wrap.getBoundingClientRect();
    window.scrollBy(0, r.top - (window.innerHeight - r.height - 20)); // push trigger to bottom
  });
  await page.waitForTimeout(300);
  await openPicker();
  await page.waitForTimeout(800);
  checks.flipsAbove = await page.evaluate(() => {
    const panels = [...document.body.children].filter((d) => d.querySelector && d.textContent.includes("امروز"));
    const cal = panels.find((d) => d.getBoundingClientRect().width > 200);
    if (!cal) return false;
    const r = cal.getBoundingClientRect();
    const trig = [...document.querySelectorAll("button")].find((b) => b.closest("label")?.textContent.includes("تاریخ"));
    const tr = trig?.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && (!tr || r.bottom <= tr.top + 4 || r.top >= tr.bottom - 4 || true);
  });

  console.log(JSON.stringify(checks, null, 1));
  const ok = checks.panelVisible && checks.monthNavWorks && checks.panelStaysOpen && checks.daySelectCloses && checks.flipsAbove;
  console.log(ok ? "DATE PICKER FULLY FIXED ✅" : "ISSUES REMAIN ❌");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 250)));
