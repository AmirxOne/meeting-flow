// E2E: organizer uploads a PDF on meeting details; file appears in the list
const { launchBrowser, login, gotoApp, finish, BASE } = require("./e2e-lib.cjs");
const { writeFileSync, unlinkSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const os = require("node:os");

const RUN = Math.floor(Date.now() / 60000);
const PDF = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  const tmp = join(os.tmpdir(), `mehrsa-e2e-agenda-${RUN}.pdf`);
  writeFileSync(tmp, PDF);

  let meetingId = "";
  let cookie = "";

  try {
    const auth = await login(page, "ali@example.com");
    cookie = `${auth.cookieName}=${auth.cookieValue}`;

    const start = new Date(Date.now() + (3 + (RUN % 5)) * 86400000);
    start.setUTCHours(13, RUN % 40, 0, 0);
    const end = new Date(start.getTime() + 30 * 60000);
    const created = await page.request.post(`${BASE}/api/meetings`, {
      headers: { "Content-Type": "application/json", Cookie: cookie },
      data: {
        title: `E2E پیوست ${RUN}`,
        branchId: "branch-niavaran",
        roomId: "room-a",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        meetingType: "INTERNAL",
      },
    });
    const body = await created.json();
    meetingId = body?.data?.meeting?.id ?? "";
    check("create meeting for attachment", created.status() === 201 && !!meetingId);

    await gotoApp(page, `/meetings/${meetingId}`, auth.userId);
    await page.waitForSelector('[data-testid="meeting-attachments"]', { timeout: 20000 });
    check("attachments card visible", (await page.locator('[data-testid="meeting-attachments"]').count()) > 0);
    check("upload button for organizer", (await page.locator('[data-testid="attachment-upload-btn"]').count()) > 0);

    await page.locator('[data-testid="attachment-file-input"]').setInputFiles(tmp);
    await page.waitForSelector('[data-testid="attachment-name"]', { timeout: 15000 });
    const nameText = await page.locator('[data-testid="attachment-name"]').first().textContent();
    check("uploaded filename shown", (nameText ?? "").includes(`mehrsa-e2e-agenda-${RUN}.pdf`));
    check("download link present", (await page.locator('[data-testid="attachment-download"]').count()) > 0);

    const list = await page.request.get(`${BASE}/api/meetings/${meetingId}/attachments`, {
      headers: { Cookie: cookie },
    });
    const listed = await list.json();
    const attId = listed?.data?.attachments?.[0]?.id;
    check("list API returns the file", list.status() === 200 && !!attId);

    if (attId) {
      const dl = await page.request.get(`${BASE}/api/meetings/${meetingId}/attachments/${attId}`, {
        headers: { Cookie: cookie },
      });
      const buf = await dl.body();
      check("download returns PDF bytes", dl.status() === 200 && buf.subarray(0, 4).toString() === "%PDF");
      await page.request.delete(`${BASE}/api/meetings/${meetingId}/attachments/${attId}`, {
        headers: { Cookie: cookie },
      });
    }
  } catch (e) {
    check(`exception: ${e.message}`, false);
  } finally {
    if (meetingId && cookie) {
      await page.request.post(`${BASE}/api/meetings/${meetingId}/cancel`, {
        headers: { "Content-Type": "application/json", Cookie: cookie },
        data: { reason: "OTHER" },
      }).catch(() => {});
    }
    if (existsSync(tmp)) unlinkSync(tmp);
  }

  return finish(results, browser);
})();
