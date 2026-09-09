// measure part 2: remaining pages, fresh browser (memory-friendly)
const { chromium } = require("playwright");

const PAGES = [
  "/dashboard",
  "/admin",
  "/admin/settings",
  "/admin/policies",
  "/admin/roles",
  "/admin/users",
  "/admin/rooms",
  "/admin/people",
  "/admin/audit-logs",
  "/profile",
  "/notifications",
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  const widths = {};
  for (const path of PAGES) {
    try {
      await page.goto("http://127.0.0.1:3100" + path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1800);
      const w = await page.evaluate(() => {
        const main = document.querySelector("main");
        const wrap = main?.firstElementChild;
        const r = wrap?.getBoundingClientRect();
        return r ? { wrap: Math.round(r.width), left: Math.round(r.left) } : { wrap: null };
      });
      widths[path] = w.wrap;
      console.log(path.padEnd(20), "wrap:", String(w.wrap).padStart(6), "| left:", w.left);
    } catch (e) {
      console.log(path.padEnd(20), "ERROR", String(e).split("\n")[0].slice(0, 60));
      widths[path] = null;
    }
  }
  const ref = widths["/dashboard"];
  console.log("\nref dashboard:", ref);
  let bad = 0;
  for (const [p, w] of Object.entries(widths)) {
    if (w && ref && Math.abs(w - ref) > 8) { console.log("MISMATCH:", p, "→", w); bad++; }
  }
  console.log(bad === 0 ? "ALL MATCH ✅" : bad + " mismatches");
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
})();
