// E2E SECURITY REGRESSION — cross-org IDOR on meeting requests
// An admin of org "sample" must NOT see/reject/update/schedule a request of org "beta".
// Run from project root. Requires seeded orgs (sample + beta) and server on :3100.
const B = 'http://127.0.0.1:3100';

const login = async (email, org) => {
  const r = await fetch(B + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Pass1234' }),
  });
  if (r.status !== 200) throw new Error('login failed for ' + email + ': ' + r.status);
  const cookie = r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const body = await r.json();
  return { cookie, user: body.data.user };
};

(async () => {
  const r = {};

  // 1) create a request as a member of org-main
  const ali = await login('ali@example.com');
  const created = await fetch(B + '/api/meeting-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: ali.cookie },
    body: JSON.stringify({ title: 'حملات IDOR تست', urgency: 'NORMAL', durationMin: 30 }),
  });
  const req = (await created.json()).data.request;
  r.created = created.status === 201;

  // 2) beta admin (ADMIN role in ANOTHER org) tries to act on it → must be 404
  const beta = await login('beta-admin@example.com');
  const reject = await fetch(B + '/api/meeting-requests/' + req.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: beta.cookie },
    body: JSON.stringify({ action: 'reject', adminNote: 'nope' }),
  });
  r.rejectCrossOrg404 = reject.status === 404;

  const update = await fetch(B + '/api/meeting-requests/' + req.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: beta.cookie },
    body: JSON.stringify({ action: 'update', title: 'hacked' }),
  });
  r.updateCrossOrg404 = update.status === 404;

  const schedule = await fetch(B + '/api/meeting-requests/' + req.id + '/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: beta.cookie },
    body: JSON.stringify({ branchId: 'branch-niavaran', roomId: 'room-a', startAt: new Date(Date.now() + 5 * 86400000).toISOString(), endAt: new Date(Date.now() + 5 * 86400000 + 3600000).toISOString() }),
  });
  r.scheduleCrossOrg404 = schedule.status === 404;

  // 3) the request is untouched
  const mine = await (await fetch(B + '/api/meeting-requests', { headers: { cookie: ali.cookie } })).json();
  const still = (mine.data.items ?? mine.data.requests ?? []).find(x => x.id === req.id);
  r.untouched = still && still.status === 'OPEN' && still.title === 'حملات IDOR تست';

  // 4) same-org admin CAN still act (positive control) — then clean up
  const admin = await login('admin@example.com');
  const okReject = await fetch(B + '/api/meeting-requests/' + req.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
    body: JSON.stringify({ action: 'reject', adminNote: 'cleanup' }),
  });
  r.sameOrgReject200 = okReject.status === 200;

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'IDOR REGRESSION ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));
})().catch(e => console.log('ERR', String(e).slice(0, 200)));
