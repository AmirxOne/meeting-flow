// E2E SECURITY REGRESSION — custom roles must be org-scoped
// An admin of org A creates a custom role; an admin of org B must not see/modify/delete it.
const B = 'http://127.0.0.1:3100';

const login = async (email) => {
  const r = await fetch(B + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Pass1234' }),
  });
  if (r.status !== 200) throw new Error('login failed ' + email + ' ' + r.status);
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
};

(async () => {
  const r = {};
  const adminA = await login('superadmin@example.com');
  const adminB = await login('beta-admin@example.com');

  // 1) org A creates a custom role
  const key = ('SEC_CUSTOM_' + Date.now().toString(36)).toUpperCase();
  const create = await fetch(B + '/api/admin/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: adminA },
    body: JSON.stringify({ key, name: 'نقش تست امنیتی', permissionKeys: ['meeting:view'] }),
  });
  const created = (await create.json()).data?.role;
  r.created = create.status === 201 && Boolean(created);

  // 2) org B list must NOT contain it
  const listB = await (await fetch(B + '/api/admin/roles', { headers: { cookie: adminB } })).json();
  r.hiddenFromB = !(listB?.data?.roles ?? []).some(x => x.key === key);

  // 3) org B cannot PATCH / DELETE it directly → 404
  const patchB = await fetch(B + '/api/admin/roles/' + created.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: adminB },
    body: JSON.stringify({ name: 'hacked' }),
  });
  r.patchBlocked = patchB.status === 404 || patchB.status === 403;

  const delB = await fetch(B + '/api/admin/roles/' + created.id, { method: 'DELETE', headers: { cookie: adminB } });
  r.deleteBlocked = delB.status === 404 || delB.status === 403;

  // 4) org A still sees and can delete its own role (cleanup)
  const listA = await (await fetch(B + '/api/admin/roles', { headers: { cookie: adminA } })).json();
  r.visibleToA = (listA?.data?.roles ?? []).some(x => x.key === key);
  const delA = await fetch(B + '/api/admin/roles/' + created.id, { method: 'DELETE', headers: { cookie: adminA } });
  r.cleanup = delA.status === 200 || delA.status === 204;

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'ROLE ORG-ISOLATION ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));
})().catch(e => console.log('ERR', String(e).slice(0, 200)));
