// E2E: confidential agenda & minutes — the 10 acceptance scenarios
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3100";
let pass = 0, total = 0;
const check = (n, ok) => { total++; if (ok) pass++; console.log((ok ? "PASS" : "FAIL") + " | " + n); };

async function login(page, email) {
  const res = await page.request.post(BASE + "/api/auth/login", {
    data: { email, password: "Pass1234" },
  });
  if (res.status() !== 200) throw new Error("login " + email + " → " + res.status());
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });

  // ── setup: admin creates a meeting (ali organizer, sara + amir participants) ──
  const adm = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admPage = await adm.newPage();
  await login(admPage, "admin@example.com");

  // find user ids
  const users = await (await admPage.request.get(BASE + "/api/users")).json();
  const byName = {};
  for (const u of users?.data?.users ?? []) byName[u.email] = u.id;
  const aliId = byName["ali@example.com"], saraId = byName["sara@example.com"], amirId = byName["amir@example.com"];

  const uniq = Date.now() % 100000;
  const start = new Date(Date.now() - (26 + (Date.now() % 5)) * 3600000); // yesterday+
  start.setUTCHours(9, (Date.now() % 2) * 30, 0, 0);
  const created = await admPage.request.post(BASE + "/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `جلسه محرمانه تست ${uniq}`,
      branchId: "branch-niavaran",
      roomId: "room-c",
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3600000).toISOString(),
      meetingType: "INTERNAL",
      participantIds: [saraId, amirId],
    },
  });
  const meetingId = (await created.json())?.data?.meeting?.id;
  check("setup: meeting created", !!meetingId);

  // approve if policy requires it, then start so minutes become writable
  const appr0 = await admPage.request.post(BASE + `/api/meetings/${meetingId}/approve`).catch(() => null);
  if (appr0 && appr0.status && appr0.status() !== 200 && appr0.status() !== 409) {
    // ignore — already approved path
  }
  const started = await admPage.request.post(BASE + `/api/meetings/${meetingId}/start`).catch(() => null);
  if (!started || !started.ok?.()) {
    // meeting may still be PENDING — force approve via API then start
    await admPage.request.post(BASE + `/api/meetings/${meetingId}/approve`).catch(() => {});
    await admPage.request.post(BASE + `/api/meetings/${meetingId}/start`).catch(() => {});
  }

  // ── scenario 1: secretary records agenda/topics/minutes ──
  // assign sara as secretary
  const sec = await admPage.request.post(BASE + `/api/meetings/${meetingId}/access`, {
    headers: { "Content-Type": "application/json" },
    data: { userIds: [saraId] },
  });
  check("1a. secretary assigned", sec.status() === 200);

  const sar = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sarPage = await sar.newPage();
  await login(sarPage, "sara@example.com");

  const put1 = await sarPage.request.put(BASE + `/api/meetings/${meetingId}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { body: `متن کامل محرمانه ${uniq} — پاراگراف اول`, summary: `خلاصه ${uniq}`, decisions: [] },
  });
  check("1b. secretary saves draft (body+summary)", put1.status() === 200);

  const topic = await sarPage.request.post(BASE + `/api/meetings/${meetingId}/topics`, {
    headers: { "Content-Type": "application/json" },
    data: { title: `موضوع عادی ${uniq}`, reviewStatus: "COVERED", sortOrder: 0 },
  });
  check("1c. secretary records open topic", topic.status() === 201);
  const openTopicId = (await topic.json())?.data?.topic?.id;

  const secretTopic = await sarPage.request.post(BASE + `/api/meetings/${meetingId}/topics`, {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `موضوع فوق‌محرمانه ${uniq}`,
      reviewStatus: "COVERED",
      visibility: "RESTRICTED",
      allowedUserIds: [saraId], // only sara
      sortOrder: 1,
    },
  });
  const secretTopicId = (await secretTopic.json())?.data?.topic?.id;
  check("1d. secretary records RESTRICTED topic", secretTopic.status() === 201);

  // ── scenario 4: participant sees summary but NOT body (SUMMARY open, BODY restricted) ──
  await admPage.request.put(BASE + `/api/meetings/${meetingId}/access`, {
    headers: { "Content-Type": "application/json" },
    data: { section: "BODY", level: "ORGANIZER_ONLY", allowedUserIds: [] },
  });

  const ami = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const amiPage = await ami.newPage();
  await login(amiPage, "amir@example.com");

  const amirMinutes = await (await amiPage.request.get(BASE + `/api/meetings/${meetingId}/minutes`)).json();
  const mm = amirMinutes?.data?.minutes;
  check("4a. participant CAN see summary", mm?.summary === `خلاصه ${uniq}`);
  check("4b. participant CANNOT see body", mm?.body === undefined && mm?.decisions === undefined);
  check("4c. access flags correct", amirMinutes?.data?.access?.summary === true && amirMinutes?.data?.access?.body === false);

  // ── scenario 5: restricted topic hidden entirely ──
  const amirTopics = await (await amiPage.request.get(BASE + `/api/meetings/${meetingId}/topics`)).json();
  const titles = (amirTopics?.data?.topics ?? []).map((t) => t.title).join("|");
  check("5a. open topic visible to participant", titles.includes(`موضوع عادی ${uniq}`));
  check("5b. restricted topic REMOVED (not masked)", !titles.includes("فوق‌محرمانه"));
  check("5c. hidden count reported", amirTopics?.data?.hiddenCount === 1);

  // ── scenario 2/3: outsider cannot fetch by ID (no involvement) ──
  const out = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const outPage = await out.newPage();
  await login(outPage, "operator@example.com"); // operator has view-all but is NOT in the meeting
  const outMinutes = await outPage.request.get(BASE + `/api/meetings/${meetingId}/minutes`);
  check("2. operator (outside meeting) → minutes API blocked", outMinutes.status() === 403 || outMinutes.status() === 404);
  const outTopics = await outPage.request.get(BASE + `/api/meetings/${meetingId}/topics`);
  check("3. topics also blocked for outsider", outTopics.status() === 403 || outTopics.status() === 404);

  // ── scenario 6: search does not leak confidential minutes ──
  const search = await (await outPage.request.get(BASE + `/api/search?q=` + encodeURIComponent(`محرمانه تست ${uniq}`))).json();
  const searchStr = JSON.stringify(search);
  check("6. search never returns minutes/topics content", !searchStr.includes("متن کامل محرمانه") && !searchStr.includes("فوق‌محرمانه"));

  // ── scenario 7: ACL change applies on the NEXT request ──
  await admPage.request.put(BASE + `/api/meetings/${meetingId}/access`, {
    headers: { "Content-Type": "application/json" },
    data: { section: "SUMMARY", level: "ORGANIZER_ONLY", allowedUserIds: [] },
  });
  const amir2 = await (await amiPage.request.get(BASE + `/api/meetings/${meetingId}/minutes`)).json();
  check("7a. summary now hidden immediately", amir2?.data?.minutes?.summary === undefined && amir2?.data?.access?.summary === false);
  // restore for later checks
  await admPage.request.put(BASE + `/api/meetings/${meetingId}/access`, {
    headers: { "Content-Type": "application/json" },
    data: { section: "SUMMARY", level: "ALL_PARTICIPANTS", allowedUserIds: [] },
  });

  // ── scenario 8: workflow DRAFT → PENDING → APPROVED → FINAL ──
  const sub = await sarPage.request.post(BASE + `/api/meetings/${meetingId}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { action: "submit" },
  });
  check("8a. secretary submits for approval", sub.status() === 200 && (await sub.json())?.data?.minutes?.status === "PENDING_APPROVAL");

  const appr = await admPage.request.post(BASE + `/api/meetings/${meetingId}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { action: "approve" },
  });
  check("8b. approver approves", appr.status() === 200);

  const fin = await admPage.request.post(BASE + `/api/meetings/${meetingId}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { action: "finalize" },
  });
  check("8c. organizer finalizes", fin.status() === 200 && (await fin.json())?.data?.minutes?.status === "FINAL");

  const lockedPut = await sarPage.request.put(BASE + `/api/meetings/${meetingId}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { body: "تلاش برای ویرایش نهایی‌شده", summary: null, decisions: [] },
  });
  check("8d. FINAL minutes are locked (409)", lockedPut.status() === 409);

  // ── scenario 9: editing summary must not clobber body ──
  // (fresh meeting needed since the last one is FINAL — use sara on a new meeting)
  const start2 = new Date(Date.now() - (50 + (Date.now() % 5)) * 3600000); // 2 days ago+
  start2.setUTCMinutes(0, 0, 0);
  const c2 = await admPage.request.post(BASE + "/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `جلسه استقلال فیلدها ${uniq}`,
      branchId: "branch-niavaran",
      roomId: "room-c",
      startAt: start2.toISOString(),
      endAt: new Date(start2.getTime() + 3600000).toISOString(),
      meetingType: "INTERNAL",
      participantIds: [saraId],
    },
  });
  const m2 = (await c2.json())?.data?.meeting?.id;
  await admPage.request.post(BASE + `/api/meetings/${m2}/approve`).catch(() => {});
  await admPage.request.post(BASE + `/api/meetings/${m2}/start`).catch(() => {});
  await admPage.request.post(BASE + `/api/meetings/${m2}/access`, {
    headers: { "Content-Type": "application/json" },
    data: { userIds: [saraId] },
  });
  await sarPage.request.put(BASE + `/api/meetings/${m2}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { body: `بدنه اصلی ${uniq}`, summary: `خلاصه اولیه`, decisions: [] },
  });
  // edit ONLY summary
  await sarPage.request.put(BASE + `/api/meetings/${m2}/minutes`, {
    headers: { "Content-Type": "application/json" },
    data: { body: `بدنه اصلی ${uniq}`, summary: `خلاصه ویرایش‌شده`, decisions: [] },
  });
  const m2get = await (await sarPage.request.get(BASE + `/api/meetings/${m2}/minutes`)).json();
  check("9. summary edit does not clobber body", m2get?.data?.minutes?.body === `بدنه اصلی ${uniq}` && m2get?.data?.minutes?.summary === "خلاصه ویرایش‌شده");

  // ── scenario 10: existing meeting flows unaffected ──
  const listAli = await (await amiPage.request.get(BASE + "/api/meetings?scope=mine")).json();
  check("10. meetings list still works", Array.isArray(listAli?.data?.meetings));
  const detail = await amiPage.request.get(BASE + `/api/meetings/${meetingId}`);
  check("10b. meeting detail unaffected", detail.status() === 200);

  // ── cleanup: cancel test meetings ──
  await admPage.request.post(BASE + `/api/meetings/${meetingId}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
  }).catch(() => {});
  await admPage.request.post(BASE + `/api/meetings/${m2}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
  }).catch(() => {});

  console.log(`\n${pass}/${total} passed`);
  await browser.close();
  process.exit(pass === total ? 0 : 1);
})().catch((e) => {
  console.log("FATAL:", String(e).slice(0, 200));
  process.exit(1);
});
