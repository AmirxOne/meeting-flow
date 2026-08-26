// E2E: forms in Modal (desktop centered) / Bottom Sheet (mobile slide-up)
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  // ── login ──
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  const cookie = { name: n.trim(), value: v.trim(), domain: "localhost", path: "/" };

  // ══ DESKTOP: people form = centered modal ══
  await page.context().addCookies([cookie]);
  await page.goto("http://localhost:3100/people", { waitUntil: "domcontentloaded" });
  await page.locator("tbody tr").first().waitFor({ timeout: 30000 });
  await page.locator('button:has-text("فرد جدید")').click();
  await page.waitForTimeout(700);

  const dlg = page.locator('[role="dialog"]');
  check("desktop: dialog opens", (await dlg.count()) === 1);
  const geom = await dlg.boundingBox();
  check(
    `desktop: centered modal (y=${Math.round(geom.y)}, h=${Math.round(geom.height)})`,
    geom.y > 60 && geom.y < 350,
  );
  // form is IN the modal now, not on page top
  check("desktop: name input inside modal", (await dlg.locator('input[placeholder*="نام و نام خانوادگی"]').count()) === 1);
  // backdrop click closes
  await page.mouse.click(30, 450);
  await page.waitForTimeout(500);
  check("desktop: backdrop click closes", (await page.locator('[role="dialog"]').count()) === 0);

  // ══ DESKTOP: admin/rooms form = modal ══
  await page.goto("http://localhost:3100/admin/rooms", { waitUntil: "domcontentloaded" });
  await page.locator("tbody tr, .skeleton").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.locator('button:has-text("اتاق جدید")').click();
  await page.waitForTimeout(700);
  const dlg2 = page.locator('[role="dialog"]');
  check("rooms: modal opens", (await dlg2.count()) === 1);
  check("rooms: fields inside modal (name+capacity)", (await dlg2.locator("input").count()) >= 3);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("rooms: Esc closes", (await page.locator('[role="dialog"]').count()) === 0);

  // ══ MOBILE: bottom sheet slides from bottom ══
  const mob = await browser.newPage({ viewport: { width: 375, height: 720 }, isMobile: true, hasTouch: true });
  await mob.context().addCookies([cookie]);
  await mob.goto("http://localhost:3100/people", { waitUntil: "domcontentloaded" });
  await mob.locator("tbody tr").first().waitFor({ timeout: 30000 });
  await mob.locator('button:has-text("فرد جدید")').click();
  await mob.waitForTimeout(800);

  const sheet = mob.locator('[role="dialog"]');
  const sg = await sheet.boundingBox();
  check(
    `mobile: sheet anchored to bottom (bottom edge=${Math.round(sg.y + sg.height)} of 720)`,
    sg.y + sg.height >= 715,
  );
  check("mobile: drag handle visible", (await sheet.locator("div.h-1\\.5.w-10").count()) === 1);
  check("mobile: sheet is full width", Math.round(sg.width) === 375);

  // drag down to dismiss
  await sheet.dragTo(mob.locator("body"), { targetPosition: { x: 180, y: 650 }, sourcePosition: { x: 180, y: 60 } }).catch(() => {});
  // fallback: swipe via touch events
  await mob.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    const t = (type, y) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: el, clientX: 180, clientY: y })] }));
    t("touchstart", 100);
    t("touchmove", 300);
    t("touchend", 500);
  }).catch(() => {});
  await mob.waitForTimeout(700);
  const sheetGone = (await mob.locator('[role="dialog"]').count()) === 0 || ((await mob.locator('[role="dialog"]').boundingBox())?.y ?? 0) > 700;
  check("mobile: drag/swipe down dismisses sheet", sheetGone);

  let pass = 0;
  for (const [nm, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${nm}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
