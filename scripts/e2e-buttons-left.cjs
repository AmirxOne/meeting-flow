// E2E: modal action buttons sit on the LEFT side of the box (RTL: justify-end)
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

  // open the rooms modal (has footer with ایجاد اتاق / انصراف)
  await page.goto("http://127.0.0.1:3100/admin/rooms", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /اتاق جدید|افزودن|ایجاد/.test(b.textContent || ""));
    btn && btn.click();
  });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { dialog: false };
    const btns = [...dlg.querySelectorAll("button")].filter((b) => /انصراف|ایجاد|ذخیره/.test(b.textContent || ""));
    if (!btns.length) return { dialog: true, btns: 0 };
    const dlgBox = dlg.getBoundingClientRect();
    // the LEFTMOST button's right edge must be in the LEFT half of the dialog
    const boxes = btns.map((b) => b.getBoundingClientRect());
    const minRight = Math.min(...boxes.map((b) => b.right));
    return {
      dialog: true,
      btns: btns.length,
      dlgMid: Math.round(dlgBox.left + dlgBox.width / 2),
      minRight: Math.round(minRight),
      leftSide: minRight < dlgBox.left + dlgBox.width / 2,
    };
  });
  console.log(JSON.stringify(r));
  console.log(r.leftSide ? "BUTTONS ON LEFT ✅" : "BUTTONS NOT LEFT ❌");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
