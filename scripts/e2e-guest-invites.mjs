// E2E: guest invitations (SMS/email) for meetings with external guests
const B = 'http://127.0.0.1:3100';
const login = async (em) => (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: 'Pass1234' }) })).headers.getSetCookie().map(c => c.split(';')[0]).join('; ');

const ac = await login('admin@example.com');
const amirC = await login('amir@example.com');

// 1) create an OFFSITE meeting with two guests (one with phone, one with email)
const d = new Date(Date.now() + 30 * 86400000); d.setUTCHours(6, 30, 0, 0);
const cr = await fetch(B + '/api/meetings', {
  method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac },
  body: JSON.stringify({
    title: 'تست دعوت مهمان — همراه اول',
    description: '📍 محل جلسه: دفتر مرکزی همراه اول',
    startAt: d.toISOString(), endAt: new Date(d.getTime() + 3600000).toISOString(),
    meetingType: 'EXTERNAL',
    participantIds: [],
    guests: [
      { name: 'مهدی رضایی', company: 'همراه اول', phone: '09121000001', email: 'mehdi@example-external.com' },
      { name: 'سمیرا کاظمی', company: 'همراه اول', email: 'samira@example-external.com' },
    ],
  }),
});
const mj = await cr.json();
console.log('1) create with guests:', cr.status, '| type:', mj?.data?.meeting?.type);
const mid = mj.data.meeting.id;

// 2) auto-invite on create — audit rows should exist (mock providers log, don't throw)
const { execSync } = await import('node:child_process');
const rows = execSync(`docker exec meetinghub-postgres-1 psql -U meetinghub -d meetinghub -t -c "SELECT COUNT(*) FROM \\"AuditLog\\" WHERE action='GUEST_INVITE_SENT' AND \\"newValue\\"->>'meetingId'='${mid}';"`, { shell: true }).toString().trim();
console.log('2) auto-invite audit rows (expect 2):', rows);

// 3) manual resend — organizer/admin
const rs = await fetch(B + '/api/meetings/' + mid + '/guest-invites', { method: 'POST', headers: { cookie: ac } });
const rj = await rs.json();
console.log('3) resend:', rs.status, '| sent:', rj?.data?.sent, '| failed:', rj?.data?.failed);

// 4) non-manager forbidden
const rf = await fetch(B + '/api/meetings/' + mid + '/guest-invites', { method: 'POST', headers: { cookie: amirC } });
console.log('4) outsider resend (expect 403):', rf.status);

// 5) audit trail grew
const rows2 = execSync(`docker exec meetinghub-postgres-1 psql -U meetinghub -d meetinghub -t -c "SELECT COUNT(*) FROM \\"AuditLog\\" WHERE action='GUEST_INVITE_SENT' AND \\"newValue\\"->>'meetingId'='${mid}';"`, { shell: true }).toString().trim();
console.log('5) audit rows after resend (expect 4):', rows2);

// cleanup
await fetch(B + '/api/meetings/' + mid + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ reason: 'OTHER' }) });
console.log('cleaned');
