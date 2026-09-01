// E2E: guest QR check-in — public lookup + self check-in POST
const { launchBrowser, login, gotoApp, finish, BASE } = require("./e2e-lib.cjs");

const RUN = Math.floor(Date.now() / 60000);

function checkinWindow() {
  const offsetMin = 35 + (RUN % 40);
  const start = new Date(Date.now() + offsetMin * 60000);
  const end = new Date(start.getTime() + 60 * 60000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

async function api(path, init = {}) {
  const { cookie, json, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  let meetingId = "";
  let checkinCode = "";
  let employeeCookie = "";

  try {
    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: "ali@example.com", password: "Pass1234" },
    });
    const sc = (await loginRes.headersArray()).find((h) => h.name === "set-cookie");
    employeeCookie = sc?.value.split(";")[0] ?? "";

    const slot = checkinWindow();
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: `E2E QR checkin ${RUN}`,
        branchId: "branch-niavaran",
        ...slot,
        meetingType: "INTERNAL",
      },
    });
    check("create meeting for checkin", created.status === 201);
    meetingId = created.body?.data?.meeting?.id ?? "";

    const added = await api(`/api/meetings/${meetingId}/guests`, {
      method: "POST",
      cookie: employeeCookie,
      json: { name: "مهمان QR E2E", company: "تست" },
    });
    check("add guest with checkin code", added.status === 201);
    checkinCode = added.body?.data?.guest?.checkinCode ?? "";
    check("checkin code format", /^[0-9A-F]{8}$/.test(checkinCode));

    const lookup = await api(`/api/checkin/${checkinCode}`);
    check("public GET lookup by code", lookup.status === 200);
    check("lookup guest name", lookup.body?.data?.guest?.name === "مهمان QR E2E");

    await page.goto(`${BASE}/checkin/${checkinCode}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('[data-testid="checkin-qr"] canvas', { timeout: 20000 });
    check("checkin page shows QR canvas", (await page.locator('[data-testid="checkin-qr"] canvas').count()) > 0);
    check("mobile page guest name", (await page.locator("text=مهمان QR E2E").count()) > 0);

    const submit = page.locator('[data-testid="checkin-submit"]').first();
    await submit.waitFor({ state: "visible", timeout: 15000 });
    await submit.click();
    await page.waitForSelector('[data-testid="checkin-success"]', { timeout: 20000 });
    check("self check-in success UI", (await page.locator('[data-testid="checkin-success"]').count()) > 0);
    check(
      "wayfinding after check-in shows branch",
      (await page.locator('[data-testid="checkin-wayfinding"]').filter({ hasText: "شعبه نیاوران" }).count()) > 0,
    );

    const postCheckin = await api(`/api/checkin/${checkinCode}`, { method: "POST" });
    check("POST checkin idempotent", postCheckin.status === 200);
    check("already checked in flag", postCheckin.body?.data?.alreadyCheckedIn === true);

    await page.setViewportSize({ width: 1280, height: 900 });
    const { userId } = await login(page, "ali@example.com");
    await gotoApp(page, `/meetings/${meetingId}`, userId);
    await page.waitForSelector("text=مهمان QR E2E", { timeout: 30000 });
    await page.locator("text=مهمان QR E2E").scrollIntoViewIfNeeded();
    await page.waitForSelector('[data-testid="checkin-qr"] canvas', { timeout: 30000 });
    check("meeting detail organizer QR", (await page.locator('[data-testid="checkin-qr"]').count()) > 0);
    check("download QR button", (await page.locator('[data-testid="checkin-download"]').count()) > 0);
    check("print QR button", (await page.locator('[data-testid="checkin-print"]').count()) > 0);
  } catch (e) {
    console.error(e);
    check("unexpected error", false);
  }

  await finish(results, browser);
})();
