// E2E: self-service forgot password for ali (mock email — debugToken in API).
const { launchBrowser, finish, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);
  const NEW_PASS = "AliReset9";

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const forgotLink = page.locator('[data-testid="forgot-password-link"]');
    await forgotLink.waitFor({ timeout: 15000 });
    check("login shows forgot-password link", await forgotLink.isVisible());

    await forgotLink.click();
    await page.waitForURL("**/forgot-password", { timeout: 15000 });
    check("navigates to forgot-password", page.url().includes("/forgot-password"));

    const identifier = page.locator('[data-testid="forgot-identifier"]');
    await identifier.waitFor({ timeout: 10000 });
    await identifier.fill("ali@example.com");

    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/forgot-password") && r.request().method() === "POST"),
      page.locator('[data-testid="forgot-submit"]').click(),
    ]);
    check("forgot-password API 200", res.status() === 200);
    const body = await res.json();
    const token = body.data?.debugToken;
    check("mock debugToken returned", typeof token === "string" && token.length > 20);
    await page.locator('[data-testid="forgot-password-sent"]').waitFor({ timeout: 10000 });
    check("success message shown", await page.locator('[data-testid="forgot-password-sent"]').isVisible());

    if (!token) throw new Error("no debugToken — cannot continue reset UI");

    await page.goto(`${BASE}/reset-password?token=${token}`, { waitUntil: "networkidle", timeout: 60000 });
    const passField = page.locator('[data-testid="reset-password"]');
    await passField.waitFor({ timeout: 15000 });
    await passField.click();
    await passField.fill("");
    await passField.pressSequentially(NEW_PASS, { delay: 20 });
    await page.locator('[data-testid="reset-confirm"]').click();
    await page.locator('[data-testid="reset-confirm"]').pressSequentially(NEW_PASS, { delay: 20 });
    await page.locator('[data-testid="reset-submit"]').click();
    await page.waitForURL("**/login", { timeout: 20000 });
    check("reset redirects to login", page.url().includes("/login"));

    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: "ali@example.com", password: NEW_PASS },
    });
    check("ali logs in with new password", loginRes.status() === 200);
    const loginBody = await loginRes.json();
    const aliId = loginBody.data?.user?.id;
    check("login payload has ali id", typeof aliId === "string");

    await page.context().clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('input[name="identifier"]').waitFor({ timeout: 15000 });
    await page.locator('input[name="identifier"]').click();
    await page.locator('input[name="identifier"]').fill("ali@example.com");
    await page.locator('input[name="password"]').click();
    await page.locator('input[name="password"]').fill(NEW_PASS);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    check("ali UI login with new password reaches dashboard", page.url().includes("/dashboard"));
  } catch (e) {
    console.error(e);
    results.push(["unhandled error", false]);
  } finally {
    try {
      const adminLogin = await page.request.post(`${BASE}/api/auth/login`, {
        data: { email: "admin@example.com", password: "Pass1234" },
      });
      const sc = (await adminLogin.headersArray()).find((h) => h.name === "set-cookie");
      const cookie = sc?.value?.split(";")[0];
      const users = await page.request.get(`${BASE}/api/users?q=ali@example.com`, {
        headers: cookie ? { cookie } : {},
      });
      const usersBody = await users.json().catch(() => ({}));
      const list = usersBody.data?.users ?? usersBody.data ?? [];
      const ali = Array.isArray(list)
        ? list.find((u) => u.email === "ali@example.com")
        : null;
      const aliId = ali?.id;
      if (aliId && cookie) {
        const restore = await page.request.post(`${BASE}/api/users/${aliId}/reset-password`, {
          headers: { cookie, "content-type": "application/json" },
          data: { password: "Pass1234" },
        });
        check("restored ali seed password", restore.status() === 200);
      } else {
        check("restored ali seed password", false);
      }
    } catch (e) {
      console.error("restore failed", e);
      results.push(["restored ali seed password", false]);
    }
  }

  await finish(results, browser);
})();
