import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// ═══ مهرسا — بنچمارک API (نسخه ۲) ═══
// لاگین فقط در setup (۶ session از کاربران seed — بدون برخورد با rate-limit لاگین)
// توزیع: فهرست جلسات ۳۰٪ · تقویم ۲۵٪ · داشبورد ۱۵٪ · اعلان‌ها ۱۲٪ · پروفایل ۱۰٪ · جزئیات جلسه ۸٪
// اجرا: k6 run --env VUS=100 --env DUR=60s bench/k6_scenarios.js

const BASE = __ENV.BASE || 'http://127.0.0.1:3100';
const PASSWORD = __ENV.PASS || 'Pass1234';
const tLogin = new Trend('t_login');
const tApi = new Trend('t_api');
const bizErrors = new Counter('biz_errors');

const USERS = [
  'admin@example.com', 'ali@example.com', 'amir@example.com', 'sara@example.com',
  'operator@example.com', 'manager@example.com',
];

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '20s', target: Number(__ENV.VUS || 10) },
        { duration: __ENV.DUR || '60s', target: Number(__ENV.VUS || 10) },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    't_api{api:meetings}': ['p(95)<500'],
    't_api{api:calendar}': ['p(95)<500'],
    't_api{api:dashboard}': ['p(95)<500'],
  },
  maxVUs: 600,
};

export function setup() {
  // یک session برای هر کاربر seed — کل تست با همین ۶ session می‌چرخد
  const sessions = [];
  for (const u of USERS) {
    const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ identifier: u, password: PASSWORD }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { api: 'login' },
    });
    tLogin.add(res.timings.duration);
    const ok = check(res, {
      'login 200': (r) => r.status === 200,
      'login ok': (r) => { try { return r.json('ok') === true; } catch { return false; } },
    }, { user: u });
    if (!ok) bizErrors.add(1, { kind: 'login' });
    const sc = res.headers['Set-Cookie'];
    if (sc) sessions.push(sc.split(';')[0]);
    sleep(0.5);
  }
  return { sessions };
}

export default function (data) {
  const cookie = data.sessions[__VU % data.sessions.length];
  const H = { headers: { Cookie: cookie } };

  const roll = Math.random() * 100;
  let r;
  if (roll < 30) {
    r = http.get(`${BASE}/api/meetings?limit=50`, { ...H, tags: { api: 'meetings' } });
  } else if (roll < 55) {
    const from = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    r = http.get(`${BASE}/api/calendar?from=${from}&to=${to}`, { ...H, tags: { api: 'calendar' } });
  } else if (roll < 70) {
    r = http.get(`${BASE}/api/dashboard`, { ...H, tags: { api: 'dashboard' } });
  } else if (roll < 82) {
    r = http.get(`${BASE}/api/notifications`, { ...H, tags: { api: 'notifications' } });
  } else if (roll < 92) {
    r = http.get(`${BASE}/api/auth/me`, { ...H, tags: { api: 'me' } });
  } else {
    // جزئیات جلسه با session سازگار با لیست — session صاحب‌لیست (اندیس ۰) تا جلسه‌ی محرمانه ۴۰۳ ندهد
    const HD = { headers: { Cookie: data.sessions[0] } };
    const list = http.get(`${BASE}/api/meetings?limit=5`, { ...HD, tags: { api: 'meetings' } });
    tApi.add(list.timings.duration, { api: 'meetings' });
    // اولین جلسه‌ی غیرمحرمانه — محرمانه‌ها به‌درستی 403 می‌دهند (سیاست privacy)
    let mid = '';
    try {
      const ms = list.json('data.meetings') || [];
      const pub = ms.find((x) => !x.isMasked);
      mid = (pub || ms[0] || {}).id || '';
    } catch {}
    if (mid) {
      const d = http.get(`${BASE}/api/meetings/${mid}`, { ...HD, tags: { api: 'detail' } });
      tApi.add(d.timings.duration, { api: 'detail' });
      if (!check(d, { 'detail 200': (x) => x.status === 200 })) bizErrors.add(1, { kind: 'detail' });
    }
    sleep(Number(__ENV.THINK || 2) + Math.random() * 2);
    return;
  }

  tApi.add(r.timings.duration, { api: r.tags.api });
  const ok = check(r, {
    'status 200': (x) => x.status === 200,
    'ok:true': (x) => { try { return x.json('ok') === true; } catch { return false; } },
  }, { api: r.tags.api });
  if (!ok) bizErrors.add(1, { kind: 'api', api: r.tags.api });

  sleep(Number(__ENV.THINK || 2) + Math.random() * 2); // think time ۲-۴s
}

export function handleSummary(data) {
  const m = data.metrics;
  const get = (name, key) => {
    const met = m[name];
    return met && met.values ? (met.values[key] ?? '—') : '—';
  };
  const summary =
    `\n═══ RESULTS VUS=${__ENV.VUS || 10} ═══\n` +
    `RPS=${get('http_reqs', 'rate')}\n` +
    `p50=${get('http_req_duration', 'med')} p90=${get('http_req_duration', 'p(90)')} p95=${get('http_req_duration', 'p(95)')} p99=${get('http_req_duration', 'p(99)')}\n` +
    `fail_rate=${get('http_req_failed', 'rate')} biz_errors=${get('biz_errors', 'count')}\n` +
    `login_p95=${get('t_login', 'p(95)')}\n`;
  return {
    [`bench/results/vus_${__ENV.VUS || 10}.json`]: JSON.stringify(data, null, 2),
    stdout: summary,
  };
}
