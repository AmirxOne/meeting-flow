// E2E: room & branch CRUD with permission checks
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

  // ══ RBAC via API first ══
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });

  // employee cannot create branch (403)
  await loginAs("ali@example.com");
  let r = await page.request.post("http://localhost:3100/api/branches", {
    headers: { "Content-Type": "application/json" },
    data: { name: "شعبه غیرمجاز" },
  });
  check(`employee blocked from branch create (${r.status()} = 403)`, r.status() === 403);

  // admin creates branch
  await loginAs("admin@example.com");
  r = await page.request.post("http://localhost:3100/api/branches", {
    headers: { "Content-Type": "application/json" },
    data: { name: "شعبه تست کراد", address: "تهران، تست", phone: "021-12345678" },
  });
  const createdBranch = (await r.json())?.data?.branch;
  check(`admin creates branch (${r.status()} = 201)`, r.status() === 201 && !!createdBranch?.id);

  // duplicate name rejected
  r = await page.request.post("http://localhost:3100/api/branches", {
    headers: { "Content-Type": "application/json" },
    data: { name: "شعبه تست کراد" },
  });
  check(`duplicate branch name rejected (${r.status()} = 409)`, r.status() === 409);

  // admin creates room in the new branch
  r = await page.request.post("http://localhost:3100/api/rooms/create", {
    headers: { "Content-Type": "application/json" },
    data: { branchId: createdBranch.id, name: "اتاق تست کراد", capacity: 5, equipment: ["TV"] },
  });
  const createdRoom = (await r.json())?.data?.room;
  check(`admin creates room (${r.status()} = 201)`, r.status() === 201 && !!createdRoom?.id);

  // edit room
  r = await page.request.patch(`http://localhost:3100/api/rooms/${createdRoom.id}/manage`, {
    headers: { "Content-Type": "application/json" },
    data: { capacity: 12, isVip: true },
  });
  const edited = (await r.json())?.data?.room;
  check(`room edited (capacity 12, VIP)`, r.status() === 200 && edited?.capacity === 12 && edited?.isVip === true);

  // disable room
  r = await page.request.patch(`http://localhost:3100/api/rooms/${createdRoom.id}/manage`, {
    headers: { "Content-Type": "application/json" },
    data: { isActive: false },
  });
  check(`room disabled (${r.status()})`, r.status() === 200);

  // re-enable then delete
  await page.request.patch(`http://localhost:3100/api/rooms/${createdRoom.id}/manage`, {
    headers: { "Content-Type": "application/json" },
    data: { isActive: true },
  });
  r = await page.request.delete(`http://localhost:3100/api/rooms/${createdRoom.id}/manage`);
  check(`room deleted (${r.status()})`, r.status() === 200);

  // try deleting a branch with meetings → blocked
  r = await page.request.delete("http://localhost:3100/api/branches/branch-niavaran");
  check(`branch-with-meetings delete blocked (${r.status()} = 409)`, r.status() === 409);

  // delete the empty test branch
  r = await page.request.delete(`http://localhost:3100/api/branches/${createdBranch.id}`);
  check(`empty branch deleted (${r.status()})`, r.status() === 200);

  // disable + re-enable a real branch (workflow-safe)
  r = await page.request.patch("http://localhost:3100/api/branches/branch-vanak", {
    headers: { "Content-Type": "application/json" },
    data: { isActive: false },
  });
  check(`branch disabled (${r.status()})`, r.status() === 200);
  r = await page.request.patch("http://localhost:3100/api/branches/branch-vanak", {
    headers: { "Content-Type": "application/json" },
    data: { isActive: true },
  });
  check(`branch re-enabled (${r.status()})`, r.status() === 200);

  // ══ UI: admin sees action buttons on branches page ══
  await page.goto("http://localhost:3100/branches", { waitUntil: "domcontentloaded" });
  await page.locator('button[title="ویرایش"]').first().waitFor({ state: "visible", timeout: 30000 });
  const editBtns = await page.locator('button[title="ویرایش"]').count();
  const delBtns = await page.locator('button[title="حذف"]').count();
  check(`branches UI shows manage buttons (${editBtns} edit / ${delBtns} delete)`, editBtns >= 2 && delBtns >= 2);

  // UI: edit branch name via form
  await page.locator('button[title="ویرایش"]').first().click();
  await page.waitForTimeout(600);
  const formVisible = await page.locator('text=ویرایش شعبه').count();
  check("edit form opens", formVisible >= 1);
  await page.screenshot({ path: "D:/meetinghub/e2e-branch-manage.png" });
  await page.locator('button:has-text("انصراف")').click();

  // UI: admin/rooms edit buttons
  await page.goto("http://localhost:3100/admin/rooms", { waitUntil: "domcontentloaded" });
  await page.locator('button[title="ویرایش"]').first().waitFor({ state: "visible", timeout: 30000 });
  const roomEdits = await page.locator('button[title="ویرایش"]').count();
  check(`admin/rooms shows edit buttons (${roomEdits})`, roomEdits >= 4);

  // employee sees NO manage buttons on branches page
  await loginAs("ali@example.com");
  await page.goto("http://localhost:3100/branches", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const empEditBtns = await page.locator('button[title="ویرایش"]').count();
  check(`employee sees no manage buttons (${empEditBtns} = 0)`, empEditBtns === 0);

  let pass = 0;
  for (const [n, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${n}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
