// E2E: door-tablet display — no login, private titles never leak
const { launchBrowser, login, finish, BASE } = require("./e2e-lib.cjs");

const RUN = Math.floor(Date.now() / 60000);
const SECRET_TITLE = `محرمانه نمایشگر ${RUN} — استراتژی مالی`;
const PUBLIC_TITLE = `نمایشگر عمومی ${RUN}`;

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
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  const adminPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const kiosk = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  let adminCookie = "";
  let employeeCookie = "";
  let privateId = "";
  let publicId = "";
  let token = "";
  let displayCode = "";

  try {
    const admin = await login(adminPage, "admin@example.com");
    adminCookie = `${admin.cookieName}=${admin.cookieValue}`;

    const empLogin = await adminPage.request.post(`${BASE}/api/auth/login`, {
      data: { email: "ali@example.com", password: "Pass1234" },
    });
    const empSc = (await empLogin.headersArray()).find((h) => h.name === "set-cookie");
    employeeCookie = empSc?.value.split(";")[0] ?? "";

    const forbidden = await api("/api/rooms/room-b/display-token", {
      method: "POST",
      cookie: employeeCookie,
    });
    check("employee cannot mint display token (403)", forbidden.status === 403);

    const rotated = await api("/api/rooms/room-b/display-token", {
      method: "POST",
      cookie: adminCookie,
    });
    check(`admin rotates display token (${rotated.status})`, rotated.status === 200);
    token = rotated.body?.data?.token ?? "";
    displayCode = rotated.body?.data?.displayCode ?? "";
    check("token length", token.length >= 32);
    check("room code is 8 hex", /^[0-9A-F]{8}$/.test(displayCode));

    const anonEmpty = await fetch(`${BASE}/api/rooms/room-b/display`);
    check("anonymous without token is 401", anonEmpty.status === 401);

    const start = new Date(Date.now() - 10 * 60000);
    const end = new Date(Date.now() + 40 * 60000);
    const created = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: SECRET_TITLE,
        branchId: "branch-niavaran",
        roomId: "room-b",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        meetingType: "INTERNAL",
        isPrivate: true,
        participantIds: [],
      },
    });
    check(`private meeting created (${created.status})`, created.status === 201);
    privateId = created.body?.data?.meeting?.id ?? "";

    const laterStart = new Date(Date.now() + 90 * 60000);
    const laterEnd = new Date(laterStart.getTime() + 30 * 60000);
    const pub = await api("/api/meetings", {
      method: "POST",
      cookie: employeeCookie,
      json: {
        title: PUBLIC_TITLE,
        branchId: "branch-niavaran",
        roomId: "room-b",
        startAt: laterStart.toISOString(),
        endAt: laterEnd.toISOString(),
        meetingType: "INTERNAL",
        isPrivate: false,
      },
    });
    check(`public next meeting created (${pub.status})`, pub.status === 201);
    publicId = pub.body?.data?.meeting?.id ?? "";

    const board = await api(`/api/rooms/room-b/display?t=${token}`);
    check("kiosk API 200 with token", board.status === 200);
    const currentTitle = board.body?.data?.current?.title ?? "";
    const nextTitle = board.body?.data?.next?.title ?? "";
    check("API masks private current title", currentTitle === "جلسه محرمانه");
    check("API does not leak secret title", JSON.stringify(board.body).indexOf(SECRET_TITLE) === -1);
    check("API shows public next title", nextTitle === PUBLIC_TITLE);
    check("API occupancy occupied", board.body?.data?.occupancy === "OCCUPIED");

    const byCode = await api(`/api/rooms/room-b/display?code=${displayCode}`);
    check("kiosk API accepts room code", byCode.status === 200 && byCode.body?.data?.current?.isMasked === true);

    await kiosk.goto(`${BASE}/rooms/room-b/display?t=${token}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await kiosk.locator('[data-testid="room-display"]').waitFor({ timeout: 20000 });
    const bodyText = await kiosk.locator("body").innerText();
    check("kiosk page has occupancy", bodyText.includes("اشغال"));
    check("kiosk shows masked title", bodyText.includes("جلسه محرمانه"));
    check("kiosk does not show secret title", !bodyText.includes("استراتژی مالی") && !bodyText.includes(SECRET_TITLE));
    check("kiosk shows public next title", bodyText.includes(PUBLIC_TITLE));
    check("kiosk clock uses persian digits", /[۰-۹]/.test(bodyText));
    check("kiosk is not the login page", !bodyText.includes("ورود به حساب"));
  } finally {
    if (privateId) {
      await api(`/api/meetings/${privateId}/cancel`, {
        method: "POST",
        cookie: employeeCookie,
        json: { reason: "OTHER" },
      });
    }
    if (publicId) {
      await api(`/api/meetings/${publicId}/cancel`, {
        method: "POST",
        cookie: employeeCookie,
        json: { reason: "OTHER" },
      });
    }
  }

  await adminPage.close();
  await kiosk.close();
  await finish(results, browser);
})();
