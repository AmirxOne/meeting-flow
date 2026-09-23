// Create a realistic COMPLETED meeting for today, driven through the real APIs
const BASE = 'http://127.0.0.1:3100';
const ADMIN = { email: 'admin@example.com', password: 'Pass1234' };

async function login(creds) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  if (!r.ok) throw new Error('login failed ' + r.status);
  const cookies = r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  return cookies;
}

async function api(path, { method = 'GET', cookie, json } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}

(async () => {
  const cookie = await login(ADMIN);
  console.log('1. admin logged in ✅');

  // users
  const people = await api('/api/public/people?branchId=', { cookie });
  const users = people.body?.data?.people || people.body?.data || [];
  const ali = users.find?.(u => u.email === 'ali@example.com');
  const sara = users.find?.(u => u.email === 'sara@example.com');
  const aliId = ali?.id || 'cmta18b2p001pu9ocmtsabw3i';
  const saraId = sara?.id || 'cmta18b37001tu9oc8pe5811y';
  console.log('2. participants resolved:', { aliId, saraId });

  // today 10:00–11:30 Tehran
  const now = new Date();
  const tehranDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now); // YYYY-MM-DD
  const start = new Date(`${tehranDay}T10:00:00+03:30`).toISOString();
  const end = new Date(`${tehranDay}T11:30:00+03:30`).toISOString();

  // create meeting (organizer = admin via session)
  const created = await api('/api/meetings', {
    method: 'POST',
    cookie,
    json: {
      title: 'جلسه بازبینی محصول — نسخه پاییز',
      description: 'مرور وضعیت نسخه‌ی جدید محصول، بازخورد مشتریان و برنامه‌ی انتشار',
      startAt: start,
      endAt: end,
      roomId: 'room-a',
      meetingType: 'INTERNAL',
      priority: 'NORMAL',
      participantIds: [aliId, saraId],
      agenda: [
        { title: 'مرور آمار استفاده از نسخه فعلی', durationMin: 15 },
        { title: 'بازخورد مشتریان کلیدی', durationMin: 20 },
        { title: 'برنامه انتشار نسخه پاییز', durationMin: 20 },
        { title: 'جمع‌بندی و تصمیمات', durationMin: 10 },
      ],
    },
  });
  console.log('3. create meeting:', created.status);
  if (created.status !== 201) { console.log(JSON.stringify(created.body).slice(0, 300)); process.exit(1); }
  const meeting = created.body.data.meeting || created.body.data;
  const id = meeting.id;
  console.log('   meeting id:', id, '| status:', meeting.status);

  // walk status → CONFIRMED → IN_PROGRESS → COMPLETED
  for (const st of ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']) {
    const r = await api(`/api/meetings/${id}/status`, { method: 'PATCH', cookie, json: { status: st } });
    console.log(`4. status → ${st}:`, r.status === 200 ? '✅' : r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }

  // minutes (صورت‌جلسه) — body + summary + publish
  const mins = await api(`/api/meetings/${id}/minutes`, {
    method: 'PUT',
    cookie,
    json: {
      body: 'جلسه با حضور علیرضا محمدی (برگزارکننده)، علی رضایی و سارا نجفی برگزار شد.\n\n۱. آمار استفاده از نسخه فعلی بررسی شد — رضایت کاربران ۴۲٪ رشد داشته است.\n۲. بازخورد مشتریان کلیدی مرور شد؛ سه درخواست اصلی ثبت شد.\n۳. برنامه انتشار نسخه پاییز تأیید شد.',
      summary: 'نسخه پاییز تأیید شد؛ انتشار در بازه دو هفته آینده.',
      topics: [
        { title: 'آمار استفاده نسخه فعلی', order: 1 },
        { title: 'بازخورد مشتریان', order: 2 },
      ],
      decisions: [
        { text: 'انتشار نسخه پاییز در دو هفته آینده', dueAt: null },
        { text: 'ثبت سه درخواست مشتریان در بک‌لاگ محصول', dueAt: null },
      ],
    },
  });
  console.log('5. minutes PUT:', mins.status === 200 ? '✅' : mins.status + ' ' + JSON.stringify(mins.body).slice(0, 150));

  // publish minutes (COMPLETED meeting → real publish)
  const pub = await api(`/api/meetings/${id}/minutes`, { method: 'POST', cookie, json: {} });
  console.log('6. publish:', pub.status === 200 || pub.status === 201 ? '✅' : pub.status + ' ' + JSON.stringify(pub.body).slice(0, 150));

  // verify read-back
  const read = await api(`/api/meetings/${id}`, { cookie });
  const m = read.body?.data?.meeting || read.body?.data || {};
  console.log('7. read-back → status:', m.status, '| has minutes:', Boolean(m.minutes));

  console.log('\nMEETING URL: http://localhost:3100/meetings/' + id);
})().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
