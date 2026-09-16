// E2E: /meetings/new — options follow the meeting type
// ONLINE → video box shown, participants hidden
// INTERNAL → video box hidden, participants shown
// SOLO → video hidden, participants hidden
// switching away from ONLINE clears video data
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const rl = await fetch("http://127.0.0.1:3100/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "operator@example.com", password: "Pass1234" }),
  });
  if (rl.status !== 200) { console.log("login fail"); process.exit(1); }
  for (const c of rl.headers.getSetCookie()) {
    const p = c.split(";")[0]; const i = p.indexOf("=");
    await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: "127.0.0.1", path: "/" }]);
  }
  await page.goto("http://127.0.0.1:3100/meetings/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);

  const pickType = (label) => page.evaluate((label) => {
    const lbl = [...document.querySelectorAll("label")].find((el) => el.textContent.trim() === "نوع جلسه");
    let sib = lbl.nextElementSibling;
    while (sib && !sib.querySelector?.("button")) sib = sib.nextElementSibling;
    sib.querySelector("button").click();
    // panel is portalled; find the listbox and click matching option
    return new Promise((resolve) => {
      setTimeout(() => {
        const list = document.querySelector('[role="listbox"]');
        if (!list) return resolve(false);
        const li = [...list.querySelectorAll("li")].find((l) => l.textContent.trim() === label);
        if (!li) return resolve(false);
        li.click();
        resolve(true);
      }, 500);
    });
  }, label);

  const state = () => page.evaluate(() => ({
    video: !!document.querySelector('[data-tour="meeting-video-link"]'),
    people: !!document.querySelector('[data-tour="people-picker"], .PeoplePicker') || document.body.innerText.includes("افراد دعوت‌شده"),
    soloNote: document.body.innerText.includes("این رزرو فقط برای خودتان") || document.body.innerText.includes("جلسه آنلاین از داخل اتاق"),
  }));

  const r = {};
  // default INTERNAL
  r.internal = await state();

  // → ONLINE
  r.switchOnline = await pickType("جلسه آنلاین");
  await page.waitForTimeout(700);
  r.online = await state();

  // fill a video url, then switch to INTERNAL → box hidden + data cleared
  await page.evaluate(() => {
    const inp = document.querySelector('[data-testid="video-url-input"]');
    if (inp) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      set.call(inp, "https://meet.google.com/test-x");
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  r.switchInternal = await pickType("داخلی");
  await page.waitForTimeout(700);
  r.backToInternal = await state();
  r.videoCleared = await page.evaluate(() => {
    const inp = document.querySelector('[data-testid="video-url-input"]');
    return !inp; // hidden entirely
  });

  // → SOLO
  r.switchSolo = await pickType("رزرو تکی");
  await page.waitForTimeout(700);
  r.solo = await state();

  console.log(JSON.stringify(r, null, 1));
  const ok =
    !r.internal.video && r.internal.people &&
    r.online.video && !r.online.people &&
    r.backToInternal && !r.backToInternal.video && r.backToInternal.people &&
    r.solo && !r.solo.video && !r.solo.people;
  console.log(ok ? "TYPE-DRIVEN OPTIONS ✅" : "MISMATCH ❌");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 250)));
