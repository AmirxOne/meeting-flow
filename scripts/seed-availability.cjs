// seed: ۵ نفر × request هفته‌ی آینده + اسلات‌های متنوع برای تست UI گروهی
const { execSync } = require("child_process");

(async () => {
  const login = await fetch("http://localhost:3100/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "Pass1234" }),
  });
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const org = await (await fetch("http://localhost:3100/api/availability-mgmt?scope=org", { headers: { Cookie: cookie } })).json();
  const members = (org?.data?.members ?? []).slice(0, 5);

  // شنبه هفته‌ی آینده
  const now = new Date();
  const sat = new Date(now);
  sat.setUTCDate(sat.getUTCDate() - ((sat.getUTCDay() + 1) % 7) + 7);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const start = fmt(sat);
  const end = fmt(new Date(sat.getTime() + 6 * 86400000));
  const deadline = new Date(sat.getTime() + 2 * 86400000);

  // پاکسازی بازه‌ی قبلی
  execSync(
    `docker exec meetinghub-postgres-1 psql -U meetinghub -d meetinghub -c "DELETE FROM \\"AvailabilityRequest\\" WHERE \\"periodStart\\" = '${start} 12:00:00'"`,
    { stdio: "pipe" },
  );

  const orgId = org?.data?.config?.orgId;
  let made = 0;
  const daySlots = [
    [["09:00", "12:00"], ["15:00", "18:00"]],   // ۲ بازه در یک روز
    [["10:00", "16:00"]],
    [["08:30", "11:30"], ["13:00", "17:00"], ["20:00", "22:00"]], // ۳ بازه
    [["14:00", "18:00"]],
    [["09:00", "13:00"], ["16:00", "19:00"]],
  ];

  for (let i = 0; i < members.length; i++) {
    const u = members[i].user;
    const rq = {
      orgId, userId: u.id, periodStart: `${start} 12:00:00`, periodEnd: `${end} 12:00:00`,
      deadline: deadline.toISOString().replace("T", " ").slice(0, 19),
      status: i === 4 ? "PENDING" : "SUBMITTED",
      submittedAt: i === 4 ? null : new Date().toISOString().replace("T", " ").slice(0, 19),
      submittedById: i === 1 ? null : (i === 4 ? null : u.id), // نفر سوم توسط ادمین
    };
    const id = `avtest_${i}_${Date.now()}`;
    execSync(
      `docker exec meetinghub-postgres-1 psql -U meetinghub -d meetinghub -c "INSERT INTO \\"AvailabilityRequest\\" (id, \\"orgId\\", \\"userId\\", \\"periodStart\\", \\"periodEnd\\", deadline, status, \\"submittedAt\\", \\"submittedById\\", \\"createdAt\\", \\"updatedAt\\") VALUES ('${id}', '${orgId}', '${u.id}', '${rq.periodStart}', '${rq.periodEnd}', '${rq.deadline}', '${rq.status}', ${rq.submittedAt ? `'${rq.submittedAt}'` : "NULL"}, ${rq.submittedById ? `'${rq.submittedById}'` : "NULL"}, now(), now())"`,
      { stdio: "pipe" },
    );
    // اسلات‌ها روی ۲ روز اول بازه
    const ds = daySlots[i % daySlots.length];
    const days = [start, fmt(new Date(sat.getTime() + 86400000))];
    let sIdx = 0;
    for (const day of days) {
      for (const [st, en] of ds.slice(sIdx, sIdx + 2)) {
        execSync(
          `docker exec meetinghub-postgres-1 psql -U meetinghub -d meetinghub -c "INSERT INTO \\"AvailabilitySlot\\" (id, \\"requestId\\", date, \\"startTime\\", \\"endTime\\", \\"createdAt\\") VALUES ('sl_${id}_${day}_${st.replace(':', '')}', '${id}', '${day} 12:00:00', '${st}', '${en}', now())"`,
          { stdio: "pipe" },
        );
      }
      sIdx += 2;
    }
    made++;
  }
  console.log(`seeded ${made} requests for period ${start} → ${end}`);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
