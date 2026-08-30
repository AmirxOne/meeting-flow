// E2E: org logoUrl appears in app shell after admin saves settings.
const { chromium } = require("playwright");
const { login, gotoApp, dismissTour, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  const testLogo = `${BASE}/logo-white.png`;
  let originalLogo = null;

  try {
    const { cookieName, cookieValue } = await login(page, "admin@example.com");

    const orgRes = await page.request.get(`${BASE}/api/admin/organization`, {
      headers: { cookie: `${cookieName}=${cookieValue}` },
    });
    const orgBody = await orgRes.json();
    originalLogo = orgBody.data?.organization?.logoUrl ?? null;

    const patch = await page.request.patch(`${BASE}/api/admin/organization`, {
      headers: { cookie: `${cookieName}=${cookieValue}` },
      data: { logoUrl: testLogo },
    });
    check("admin PATCH logoUrl", patch.status() === 200);

    await gotoApp(page, "/dashboard");
    await dismissTour(page);

    const brandImg = page.locator("aside img[alt]").first();
    await brandImg.waitFor({ timeout: 15000 });
    const src = await brandImg.getAttribute("src");
    check("shell shows custom logo src", src?.includes("logo-white") ?? false);

    const alt = await brandImg.getAttribute("alt");
    check("shell logo alt is org name", !!alt && alt.length > 0);

    const branding = await page.request.get(`${BASE}/api/organization/branding`, {
      headers: { cookie: `${cookieName}=${cookieValue}` },
    });
    check("branding API returns logoUrl", branding.status() === 200);
    const brandingBody = await branding.json();
    check(
      "branding logoUrl matches",
      brandingBody.data?.branding?.logoUrl === testLogo,
    );
  } finally {
    try {
      const { cookieName, cookieValue } = await login(page, "admin@example.com");
      await page.request.patch(`${BASE}/api/admin/organization`, {
        headers: { cookie: `${cookieName}=${cookieValue}` },
        data: { logoUrl: originalLogo ?? "" },
      });
    } catch {
      /* best-effort restore */
    }
    await browser.close();
  }

  const failed = results.filter(([, ok]) => !ok);
  console.log("\n--- e2e-org-branding ---");
  for (const [name, ok] of results) console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (failed.length) {
    console.error(`\n${failed.length} failed`);
    process.exit(1);
  }
  console.log(`\n${results.length}/${results.length} passed`);
})();
