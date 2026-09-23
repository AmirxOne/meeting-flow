// finish the demo meeting: start → end → minutes draft → submit → approve → finalize
const BASE = 'http://127.0.0.1:3100';
const MEETING_ID = process.argv[2] || 'cmudwad6u000eu960ia57ayqo';

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }),
  });
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}

async function api(path, { method = 'GET', cookie, json } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

(async () => {
  const cookie = await login();
  const id = MEETING_ID;

  // start → IN_PROGRESS
  let r = await api(`/api/meetings/${id}/start`, { method: 'POST', cookie, json: {} });
  console.log('start:', r.status, r.status !== 200 ? JSON.stringify(r.body).slice(0, 120) : 'IN_PROGRESS ✅');

  // minutes draft (allowed while IN_PROGRESS)
  r = await api(`/api/meetings/${id}/minutes`, {
    method: 'PUT',
    cookie,
    json: {
      body: 'جلسه بازبینی محصول با حضور علیرضا محمدی (برگزارکننده)، علی رضایی و سارا نجفی برگزار شد.\n\n۱. آمار استفاده از نسخه‌ی فعلی بررسی شد — رضایت کاربران ۴۲٪ رشد داشته است.\n۲. بازخورد مشتریان کلیدی مرور شد و سه درخواست اصلی در بک‌لاگ ثبت شد.\n۳. برنامه‌ی انتشار نسخه‌ی پاییز بررسی و تأیید شد.',
      summary: 'نسخه پاییز تأیید شد؛ انتشار در بازه دو هفته آینده.',
      topics: [
        { title: 'آمار استفاده نسخه فعلی', order: 1 },
        { title: 'بازخورد مشتریان کلیدی', order: 2 },
        { title: 'برنامه انتشار نسخه پاییز', order: 3 },
      ],
      decisions: [
        { text: 'انتشار نسخه پاییز در دو هفته آینده', dueAt: null },
        { text: 'ثبت سه درخواست مشتریان در بک‌لاگ محصول', dueAt: null },
        { text: 'بازبینی مجدد در جلسه بعدی', dueAt: null },
      ],
    },
  });
  console.log('minutes draft:', r.status, r.status !== 200 ? JSON.stringify(r.body).slice(0, 150) : '✅');

  // end → COMPLETED
  r = await api(`/api/meetings/${id}/end`, { method: 'POST', cookie, json: {} });
  console.log('end:', r.status, r.status !== 200 ? JSON.stringify(r.body).slice(0, 120) : 'COMPLETED ✅');

  // workflow: submit → approve → finalize
  for (const action of ['submit', 'approve', 'finalize']) {
    r = await api(`/api/meetings/${id}/minutes`, { method: 'POST', cookie, json: { action } });
    console.log(`minutes ${action}:`, r.status, r.status !== 200 ? JSON.stringify(r.body).slice(0, 150) : '✅');
  }

  // read-back
  r = await api(`/api/meetings/${id}`, { cookie });
  const m = r.body?.data?.meeting || r.body?.data || {};
  console.log('\nread-back → status:', m.status, '| minutes.status:', m.minutes?.status, '| decisions:', m.minutes?.decisions?.length, '| topics:', m.minutes?.topics?.length);
  console.log('URL: http://localhost:3100/meetings/' + id);
})().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
