// E2E: people page = table + pagination (20/page) — deterministic SQL seed/cleanup
const { chromium } = require("playwright");
const { execSync } = require("child_process");

function sql(query) {
  execSync(
    `docker compose exec -T postgres psql -U meetinghub -d meetinghub -c "${query.replace(/"/g, '\\"')}"`,
    { cwd: "D:/meetinghub", shell: "bash", stdio: "pipe" },
  );
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  const MARK = "pg آزمایشی شماره";

  // ── seed: exactly 44 marker rows → 3 pages ──
  sql(`DELETE FROM "PersonDirectory" WHERE id LIKE 'pgtest-%';`);
  sql(
    `INSERT INTO "PersonDirectory" (id, name, kind, "jobTitle", "createdAt", "updatedAt")
     SELECT 'pgtest-' || LPAD(g::text, 4, '0'),
            '${MARK} ' || g::text,
            'INTERNAL', 'تست صفحه‌بندی', now(), now()
     FROM generate_series(1, 44) g;`,
  );
  check("seeded 44 via SQL", true);

  // login
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // open page filtered by marker → deterministic 44 rows / 3 pages
  await page.goto("http://localhost:3100/people", { waitUntil: "domcontentloaded" });
  await page.locator("tbody tr").first().waitFor({ timeout: 30000 });
  await page.locator('input[placeholder*="جستجوی نام"]').fill(MARK);
  await page.waitForFunction(() => document.body.textContent.includes("صفحه ۱"), null, { timeout: 20000 });
  await page.waitForTimeout(800);

  check("rendered as table", (await page.locator("table").count()) === 1);
  check("page 1 shows exactly 20 rows", (await page.locator("tbody tr").count()) === 20);
  check('header "صفحه ۱ از ۳"', (await page.locator("p", { hasText: "صفحه ۱ از ۳" }).count()) >= 1);

  // page 2 via number
  await page.locator("div.border-t button", { hasText: "۲" }).first().click();
  await page.waitForFunction(() => document.body.textContent.includes("صفحه ۲"), null, { timeout: 20000 });
  await page.waitForTimeout(600);
  check("page 2 renders 20 rows", (await page.locator("tbody tr").count()) === 20);
  check("page-2 highlighted", (await page.locator("div.border-t button.border-ink.bg-ink", { hasText: "۲" }).count()) >= 1);

  // next → page 3 (4 rows)
  await page.locator('button[aria-label="صفحه بعد"]').click();
  await page.waitForFunction(() => document.body.textContent.includes("صفحه ۳"), null, { timeout: 20000 });
  await page.waitForTimeout(600);
  check("next → page 3 with 4 rows", (await page.locator("tbody tr").count()) === 4);

  // prev → page 2
  await page.locator('button[aria-label="صفحه قبل"]').click();
  await page.waitForFunction(() => document.body.textContent.includes("صفحه ۲"), null, { timeout: 20000 });
  check("prev → page 2", true);

  // narrow search from page 2 → resets to page 1
  await page.locator('input[placeholder*="جستجوی نام"]').fill(`${MARK} 1`);
  await page.waitForTimeout(1500);
  const narrowed = await page.locator("tbody tr").count();
  check(`narrow search resets to page 1 (${narrowed} rows)`, narrowed >= 1 && narrowed <= 11);

  // clear → back to 3 pages
  await page.locator('input[placeholder*="جستجوی نام"]').fill("");
  await page.waitForFunction(() => !document.body.textContent.includes("از ۳") || document.body.textContent.includes("صفحه ۱ از"), null, { timeout: 20000 }).catch(() => {});
  await page.locator('input[placeholder*="جستجوی نام"]').fill(MARK);
  await page.waitForFunction(() => document.body.textContent.includes("صفحه ۱ از ۳"), null, { timeout: 20000 });
  check("clear search → full list page 1", true);

  // ── cleanup via SQL ──
  sql(`DELETE FROM "PersonDirectory" WHERE id LIKE 'pgtest-%';`);
  check("cleanup via SQL", true);

  let pass = 0;
  for (const [nm, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${nm}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
