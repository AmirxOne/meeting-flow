// E2E: enable TOTP from profile, then login with password + 6-digit code.
const crypto = require("node:crypto");
const { login, launchBrowser, gotoApp, finish, BASE, safeClick, dismissTour } = require("./e2e-lib.cjs");

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  const cleaned = String(input).toUpperCase().replace(/=+$/g, "").replace(/[\s-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, atMs = Date.now()) {
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1e6).padStart(6, "0");
}

async function sqlCleanupAli2fa() {
  const { execSync } = require("node:child_process");
  const path = require("node:path");
  const sql = `
UPDATE "User"
SET "totpEnabled" = false,
    "totpEnabledAt" = NULL,
    "totpSecretEnc" = NULL,
    "totpRecoveryHashes" = ARRAY[]::TEXT[]
WHERE email = 'ali@example.com';
DELETE FROM "TwoFactorChallenge"
WHERE "userId" IN (SELECT id FROM "User" WHERE email = 'ali@example.com');
`;
  try {
    execSync("docker compose exec -T postgres psql -U meetinghub -d meetinghub", {
      cwd: path.join(__dirname, ".."),
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    });
  } catch (e) {
    console.error("sql 2fa cleanup:", e.message);
  }
}

async function fillOtp(locator, code) {
  await locator.waitFor({ state: "attached", timeout: 15000 });
  await locator.click({ force: true });
  await locator.fill(code, { force: true });
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  try {
    await sqlCleanupAli2fa();
    const { userId } = await login(page, "ali@example.com", "Pass1234");
    await gotoApp(page, "/profile", userId);

    const card = page.locator('[data-testid="two-factor-card"]');
    await card.waitFor({ timeout: 20000 });
    check("profile shows 2FA card", await card.isVisible());

    await safeClick(page, page.locator('[data-testid="two-factor-start"]'));
    await page.locator('[data-testid="two-factor-setup"]').waitFor({ timeout: 15000 });
    check("setup QR shown", await page.locator('[data-testid="two-factor-qr"]').isVisible());

    const secretText = (await page.locator('[data-testid="two-factor-secret"]').innerText()).replace(/\s+/g, "");
    check("secret is base32", /^[A-Z2-7]{32}$/.test(secretText));

    const code = generateTotp(secretText);
    await dismissTour(page);
    await fillOtp(page.locator('[data-testid="two-factor-confirm"]'), code);
    await safeClick(page, page.locator('[data-testid="two-factor-enable"]'));

    await page.locator('[data-testid="two-factor-recovery-codes"]').waitFor({ timeout: 15000 });
    const recoveryCount = await page.locator('[data-testid="two-factor-recovery-codes"] li').count();
    check("shows 10 recovery codes", recoveryCount === 10);
    await page.locator('[data-testid="two-factor-recovery-done"]').click();
    await page.locator('[data-testid="two-factor-status"]').waitFor({ timeout: 10000 });
    const status = await page.locator('[data-testid="two-factor-status"]').innerText();
    check("status is enabled", status.includes("فعال"));

    await page.context().clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('input[name="identifier"]').fill("ali@example.com");
    await page.locator('input[name="password"]').fill("Pass1234");
    await page.locator('form button[type="submit"]').click();

    await page.locator('[data-testid="login-2fa-form"]').waitFor({ timeout: 15000 });
    check("login asks for 2FA code", await page.locator('[data-testid="login-2fa-code"]').isVisible());

    const loginCode = generateTotp(secretText);
    await fillOtp(page.locator('[data-testid="login-2fa-code"]'), loginCode);
    const [twoFaRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login/2fa") && r.request().method() === "POST"),
      page.locator('[data-testid="login-2fa-submit"]').click({ force: true }),
    ]);
    if (twoFaRes.status() !== 200) {
      const body = await twoFaRes.text();
      throw new Error(`login/2fa ${twoFaRes.status()} ${body.slice(0, 400)}`);
    }
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    check("2FA login reaches dashboard", page.url().includes("/dashboard"));

    const me = await page.request.get(`${BASE}/api/auth/me`);
    check("session cookie after 2FA", me.status() === 200);

    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('[data-testid="two-factor-disable"]').waitFor({ timeout: 15000 });
    await safeClick(page, page.locator('[data-testid="two-factor-disable"]'));
    const disableCode = generateTotp(secretText);
    await page.locator('[data-testid="two-factor-disable-code"]').waitFor({ timeout: 10000 });
    await fillOtp(page.locator('[data-testid="two-factor-disable-code"]'), disableCode);
    await page.locator('[data-testid="two-factor-disable-confirm"]').click();
    await page.waitForTimeout(1500);
    const after = await page.locator('[data-testid="two-factor-status"]').innerText();
    check("2FA disabled after login test", after.includes("نیست") || after.includes("فعال نیست"));
  } catch (e) {
    console.error(e);
    results.push(["unhandled error", false]);
  } finally {
    await sqlCleanupAli2fa();
  }

  return finish(results, browser);
})();
