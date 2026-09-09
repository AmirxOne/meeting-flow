// measure v3: widest CONTENT (cards) width per page — apples to apples
const { chromium } = require("playwright");

const PAGES = [
  "/dashboard", "/calendar", "/meetings", "/meetings/new", "/notifications",
  "/people", "/users", "/rooms", "/branches", "/availability", "/reports",
  "/profile", "/admin", "/admin/settings", "/admin/policies", "/admin/roles",
  "/admin/users", "/admin/rooms", "/admin/people", "/admin/audit-logs",
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
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  const widths = {};
  for (const path of PAGES) {
    try {
      await page.goto("http://127.0.0.1:3100" + path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2000);
      const w = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return { content: -1 };
        // widest rendered content row inside main (cards, tables, grids)
        let maxRight = 0, minLeft = 1e9;
        for (const el of main.querySelectorAll("div, table, section, form")) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (cs.position === "fixed" || cs.position === "absolute") continue;
          // only visible substantial blocks (skip tiny chips)
          if (r.width > 300 && r.height > 40) {
            maxRight = Math.max(maxRight, r.right);
            minLeft = Math.min(minLeft, r.left);
          }
        }
        if (maxRight === 0) return { content: null };
        return { content: Math.round(maxRight - minLeft), left: Math.round(minLeft), right: Math.round(maxRight) };
      });
      widths[path] = w.content;
      console.log(path.padEnd(20), "content:", String(w.content).padStart(7), "| left:", w.left, "| right:", w.right);
    } catch (e) {
      console.log(path.padEnd(20), "ERROR", String(e).split("\n")[0].slice(0, 60));
      widths[path] = null;
    }
  }
  const ref = widths["/dashboard"];
  console.log("\n=== mismatch vs dashboard (" + ref + "px), tolerance 16px ===");
  for (const [p, w] of Object.entries(widths)) {
    if (w && ref && Math.abs(w - ref) > 16) console.log(p, "→", w + "px", "(diff " + (w - ref) + ")");
  }
  await browser.close();
})();
