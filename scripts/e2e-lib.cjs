// Shared helpers for Playwright E2E scripts (meeting-flow)
const { chromium } = require("playwright");

const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3100";

const ALL_TOURS = [
  "dashboard", "calendar", "meetings-list", "meetings-new", "meeting-detail", "admin", "people", "rooms",
  "availability", "reports", "notifications", "branches", "users", "profile",
];

function markToursSeenScript({ uid, tours }) {
  if (uid) localStorage.setItem(`nextstep-seen:${uid}`, JSON.stringify(tours));
  localStorage.setItem("nextstep-seen:anon", JSON.stringify(tours));
  for (const key of Object.keys(localStorage).filter((k) => k.startsWith("nextstep-seen:"))) {
    localStorage.setItem(key, JSON.stringify(tours));
  }
}

async function login(page, email = "admin@example.com", password = "Pass1234") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const res = await page.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
  if (res.status() !== 200) throw new Error(`login failed ${email} → ${res.status()}`);
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  const meRes = await page.request.get(`${BASE}/api/auth/me`, {
    headers: { cookie: `${n.trim()}=${v.trim()}` },
  });
  const meBody = await meRes.json();
  const userId = meBody.user?.id;
  await page.context().addInitScript(markToursSeenScript, { uid: userId, tours: ALL_TOURS });
  await page.evaluate(markToursSeenScript, { uid: userId, tours: ALL_TOURS });
  return { cookieName: n.trim(), cookieValue: v.trim(), userId };
}

async function dismissTour(page) {
  await page.evaluate(({ tours }) => {
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith("nextstep-seen:"))) {
      localStorage.setItem(key, JSON.stringify(tours));
    }
    document.querySelectorAll('[data-name^="nextstep-"]').forEach((el) => el.remove());
  }, { tours: ALL_TOURS });
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    const overlay = await page.locator('[data-name="nextstep-overlay"]').count();
    const prevent = await page.locator('[data-name^="nextstep-prevent-click"]').count();
    if (overlay === 0 && prevent === 0) break;
    await page.evaluate(() => {
      document.querySelectorAll('[data-name^="nextstep-"]').forEach((el) => el.remove());
    });
    await page.waitForTimeout(350);
  }
}

async function safeClick(page, locator) {
  const target = locator.first();
  await dismissTour(page);
  await target.waitFor({ state: "visible", timeout: 30000 });
  try {
    await target.click({ timeout: 5000 });
  } catch {
    await dismissTour(page);
    await target.evaluate((el) => el.click());
  }
}

async function gotoApp(page, path, userId) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  try {
    await page.evaluate(markToursSeenScript, { uid: userId, tours: ALL_TOURS });
  } catch {
    /* ignore — e.g. transient document state */
  }
  await dismissTour(page);
}

async function launchBrowser() {
  return chromium.launch({ executablePath: CHROME_PATH, headless: true });
}

function finish(results, browser) {
  let pass = 0;
  for (const [n, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${n}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  return browser.close().then(() => process.exit(pass === results.length ? 0 : 1));
}

module.exports = {
  CHROME_PATH,
  BASE,
  ALL_TOURS,
  markToursSeenScript,
  login,
  dismissTour,
  safeClick,
  gotoApp,
  launchBrowser,
  finish,
};
