// E2E: room exclusion CRUD — API + admin/rooms UI
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  async function loginAs(email) {
    const res = await page.request.post("http://localhost:3100/api/auth/login", {
      data: { email, password: "Pass1234" },
    });
    if (res.status() !== 200) throw new Error("login failed " + email + " → " + res.status());
    const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
    const [n, v] = sc.value.split(";")[0].split("=");
    await page.context().clearCookies();
    await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  }

  function tehran(dayOffset, hour, minute = 0) {
    const t = new Date(Date.now() + 210 * 60000);
    const base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 210 * 60000;
    return new Date(base + dayOffset * 86400000 + hour * 3600000 + minute * 60000).toISOString();
  }

  let testRoomId = "";
  let exclusionId = "";
  const exDay = 30;

  await loginAs("admin@example.com");

  let r = await page.request.post("http://localhost:3100/api/rooms/create", {
    headers: { "Content-Type": "application/json" },
    data: { branchId: "branch-niavaran", name: "اتاق E2E exclusion", capacity: 4 },
  });
  testRoomId = (await r.json())?.data?.room?.id;
  check(`create temp room (${r.status()} = 201)`, r.status() === 201 && !!testRoomId);

  r = await page.request.post(`http://localhost:3100/api/rooms/${testRoomId}/exclusions`, {
    headers: { "Content-Type": "application/json" },
    data: {
      reason: "تعمیرات E2E",
      startAt: tehran(exDay, 10),
      endAt: tehran(exDay, 13),
    },
  });
  exclusionId = (await r.json())?.data?.exclusion?.id;
  check(`schedule exclusion (${r.status()} = 201)`, r.status() === 201 && !!exclusionId);

  r = await page.request.get(`http://localhost:3100/api/rooms/${testRoomId}/exclusions`);
  const list = (await r.json())?.data?.exclusions ?? [];
  check(`list exclusions (${list.length} >= 1)`, r.status() === 200 && list.length >= 1);

  r = await page.request.post("http://localhost:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: "E2E exclusion block",
      branchId: "branch-niavaran",
      roomId: testRoomId,
      startAt: tehran(exDay, 10, 30),
      endAt: tehran(exDay, 11, 30),
      meetingType: "INTERNAL",
    },
  });
  check(`booking blocked during exclusion (${r.status()} = 409)`, r.status() === 409);

  await page.goto("http://localhost:3100/admin/rooms", { waitUntil: "domcontentloaded" });
  await page.locator('button[data-tooltip="تعمیر / غیرفعال موقت"]').first().waitFor({ state: "visible", timeout: 30000 });
  const wrenchCount = await page.locator('button[data-tooltip="تعمیر / غیرفعال موقت"]').count();
  check(`admin/rooms shows exclusion buttons (${wrenchCount} >= 4)`, wrenchCount >= 4);

  await page.locator('button[data-tooltip="تعمیر / غیرفعال موقت"]').first().click();
  await page.waitForTimeout(600);
  const modalVisible = await page
    .locator("text=غیرفعال‌سازی آینده‌ای ثبت نشده")
    .or(page.locator("text=تعمیرات"))
    .count();
  check("exclusion modal opens", modalVisible >= 1);

  r = await page.request.delete(`http://localhost:3100/api/rooms/${testRoomId}/exclusions/${exclusionId}`);
  check(`delete exclusion (${r.status()} = 200)`, r.status() === 200);
  r = await page.request.delete(`http://localhost:3100/api/rooms/${testRoomId}/manage`);
  check(`delete temp room (${r.status()} = 200)`, r.status() === 200);

  let pass = 0;
  for (const [n, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${n}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
