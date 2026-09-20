// E2E: Excel + PDF exports from /api/reports (run from project root)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('D:/meetinghub/package.json');
const ExcelJS = require('exceljs');

const B = 'http://127.0.0.1:3100';
const cookie = (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }) })).headers.getSetCookie().map(c => c.split(';')[0]).join('; ');

// seed two meetings in range
const d1 = new Date(Date.now() - 3 * 86400000); d1.setUTCHours(6, 0, 0, 0);
const d2 = new Date(Date.now() - 1 * 86400000); d2.setUTCHours(8, 30, 0, 0);
for (const [i, d] of [d1, d2].entries()) {
  await fetch(B + '/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ title: 'خروجی تست ' + i, branchId: 'branch-niavaran', roomId: 'room-a', startAt: d.toISOString(), endAt: new Date(d.getTime() + 5400000).toISOString(), meetingType: 'INTERNAL', participantIds: [] }) });
}

const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const q = `from=${from}&to=${to}`;

// xlsx
const rx = await fetch(`${B}/api/reports?${q}&format=xlsx`, { headers: { cookie } });
const xbuf = Buffer.from(await rx.arrayBuffer());
fs.writeFileSync('D:/meetinghub/_exp.xlsx', xbuf);
console.log('xlsx:', rx.status, '| bytes:', xbuf.length, '| zip magic:', xbuf.slice(0, 2).toString() === 'PK');

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(xbuf);
const ws = wb.getWorksheet('جلسات');
const titles = [];
ws.eachRow((row, n) => { if (n > 1) titles.push(row.getCell(1).value); });
console.log('xlsx rows:', titles.length, '| seeded titles found:', titles.filter(t => String(t).includes('خروجی تست')).length);
const sum = wb.getWorksheet('خلاصه');
console.log('xlsx summary sheet:', Boolean(sum));

// pdf
const rp = await fetch(`${B}/api/reports?${q}&format=pdf`, { headers: { cookie } });
const pbuf = Buffer.from(await rp.arrayBuffer());
fs.writeFileSync('D:/meetinghub/_exp.pdf', pbuf);
console.log('pdf:', rp.status, '| bytes:', pbuf.length, '| %PDF magic:', pbuf.slice(0, 4).toString() === '%PDF', '| %%EOF:', pbuf.slice(-8).toString().includes('%%EOF'));

// cleanup
const { execSync } = await import('node:child_process');
execSync(`docker exec meetinghub-postgres-1 psql -U meetinghub -d meetinghub -c "DELETE FROM \\"Meeting\\" WHERE title LIKE '%خروجی تست%';"`, { shell: true });
console.log('cleaned');
