// E2E: installable PWA shell + mobile «جلسات من» with RSVP (no horizontal overflow)
const { login, dismissTour, safeClick, launchBrowser, finish, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  let meetingId = "";
  let aliCookie = "";

  try {
    const boot = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const amir = await login(boot, "amir@example.com");
    const amirMe = await boot.request.get(`${BASE}/api/auth/me`);
    const amirMeBody = await amirMe.json();
    const amirId = amirMeBody?.data?.user?.id ?? amir.userId;
    check("resolved amir user id", typeof amirId === "string" && amirId.length > 8);

    const man = await boot.request.get(`${BASE}/manifest.webmanifest`);
    check(`manifest served (${man.status()})`, man.status() === 200);
    const manBody = await man.json().catch(() => ({}));
    check("manifest name مهرسا", String(manBody.name ?? manBody.short_name ?? "").includes("مهرسا"));
    check("manifest display standalone", manBody.display === "standalone");
    check("manifest start_url /meetings", String(manBody.start_url ?? "").includes("/meetings"));
    check("manifest dir rtl", manBody.dir === "rtl");
    const icons = Array.isArray(manBody.icons) ? manBody.icons : [];
    check(
      `manifest has 192+512 icons (${icons.length})`,
      icons.some((i) => String(i.sizes).includes("192")) && icons.some((i) => String(i.sizes).includes("512")),
    );

    const swRes = await boot.request.get(`${BASE}/sw.js`);
    const swText = await swRes.text();
    check(`sw.js served (${swRes.status()})`, swRes.status() === 200);
    check("sw.js has fetch handler", swText.includes("addEventListener") && swText.includes("fetch"));

    const aliPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const ali = await login(aliPage, "ali@example.com");
    aliCookie = `${ali.cookieName}=${ali.cookieValue}`;
    const start = new Date(Date.now() + 25 * 60000);
    const end = new Date(start.getTime() + 30 * 60000);
    const created = await aliPage.request.post(`${BASE}/api/meetings`, {
      headers: { "Content-Type": "application/json", Cookie: aliCookie },
      data: {
        title: `E2E PWA دعوت ${Date.now()}`,
        branchId: "branch-niavaran",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        meetingType: "INTERNAL",
        participantIds: [amirId],
      },
    });
    const createdBody = await created.json().catch(() => ({}));
    meetingId = createdBody?.data?.meeting?.id ?? "";
    check(
      `plant invitee meeting (${created.status()} ${createdBody?.error?.message ?? ""})`,
      created.status() === 201 && !!meetingId,
    );
    await aliPage.close();
    await boot.close();

    const mob = await browser.newPage({
      viewport: { width: 375, height: 720 },
      isMobile: true,
      hasTouch: true,
    });
    await mob.context().addCookies([
      { name: amir.cookieName, value: amir.cookieValue, domain: "localhost", path: "/" },
    ]);
    await mob.addInitScript(({ uid, tours }) => {
      if (uid) localStorage.setItem(`nextstep-seen:${uid}`, JSON.stringify(tours));
      localStorage.setItem("nextstep-seen:anon", JSON.stringify(tours));
    }, { uid: amir.userId, tours: [
      "dashboard", "calendar", "meetings-list", "meetings-new", "meeting-detail", "admin", "people", "rooms",
      "availability", "reports", "notifications", "branches", "users", "profile",
    ] });

    await mob.goto(`${BASE}/meetings`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mob.locator("h1").first().waitFor({ timeout: 30000 });
    await mob.waitForTimeout(2000);
    await dismissTour(mob);

    const h1 = (await mob.locator("h1").first().innerText()).trim();
    check(`mobile heading جلسات من («${h1}»)`, h1.includes("جلسات"));

    check("mobile: امروز tab", (await mob.getByRole("tab", { name: "امروز" }).count()) >= 1);
    check("mobile: این هفته tab", (await mob.getByRole("tab", { name: "این هفته" }).count()) >= 1);

    const overflow = await mob.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`mobile: no horizontal overflow (${overflow}px)`, overflow <= 1);

    const acceptBtn = mob.locator('[data-testid="rsvp-accept"]');
    await acceptBtn.first().waitFor({ timeout: 15000 }).catch(() => {});
    check("mobile: RSVP قبول visible", (await acceptBtn.count()) >= 1);
    check("mobile: RSVP رد visible", (await mob.locator('[data-testid="rsvp-decline"]').count()) >= 1);

    const bottomMeetings = mob.locator('nav.fixed a[href="/meetings"]');
    check("mobile nav: جلسات من", (await bottomMeetings.count()) >= 1);

    const swOk = await mob.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    });
    check("service worker registered", swOk);

    if ((await acceptBtn.count()) >= 1) {
      await dismissTour(mob);
      await safeClick(mob, acceptBtn);
      await mob.locator("text=پاسخ شما ثبت شد").first().waitFor({ timeout: 10000 }).catch(() => {});
      check("RSVP accept shows toast", (await mob.locator("text=پاسخ شما ثبت شد").count()) >= 1);
    } else {
      check("RSVP accept shows toast", false);
    }

    await dismissTour(mob);
    await safeClick(mob, mob.getByRole("tab", { name: "این هفته" }));
    await mob.waitForTimeout(800);
    await dismissTour(mob);
    const overflowWeek = await mob.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`week tab: no horizontal overflow (${overflowWeek}px)`, overflowWeek <= 1);
    check("week tab still lists meetings or empty", (await mob.locator("h1").count()) >= 1);

    await mob.close();
  } catch (err) {
    check(`uncaught: ${String(err.message || err).slice(0, 120)}`, false);
  }

  if (meetingId && aliCookie) {
    try {
      const cleanup = await browser.newPage();
      await cleanup.request.post(`${BASE}/api/meetings/${meetingId}/cancel`, {
        headers: { "Content-Type": "application/json", Cookie: aliCookie },
        data: { reason: "OTHER", note: "e2e-pwa cleanup" },
      });
      await cleanup.close();
    } catch {
      /* ignore */
    }
  }

  await finish(results, browser);
})();
