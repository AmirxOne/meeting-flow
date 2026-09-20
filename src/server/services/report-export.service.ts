// Excel (.xlsx) and PDF exports for org meeting reports.
// Excel: exceljs — RTL worksheet, Persian headers, summary sheet.
// PDF: pdfkit with embedded Vazirmatn — RTL report layout, summary block
// plus a meeting table. No external network at runtime.

import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { MeetingRow } from "./report.service";
import { formatJalali } from "@/lib/jalali";
import { faNum } from "@/lib/fa";

const STATUS_FA: Record<string, string> = {
  PENDING_APPROVAL: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  CONFIRMED: "قطعی",
  RESCHEDULED: "جابه‌جا شده",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "برگزارشده",
  CANCELLED: "لغو شده",
  REJECTED: "رد شده",
};
const TYPE_FA: Record<string, string> = {
  INTERNAL: "داخلی",
  EXTERNAL: "بیرونی",
  ONLINE: "آنلاین",
};

export interface ExportMeta {
  from?: Date;
  to?: Date;
  total: number;
}

/* ── Excel ─────────────────────────────────────────────────── */

export async function meetingsXlsx(rows: MeetingRow[], meta: ExportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "مهرسا";
  wb.created = new Date();

  const ws = wb.addWorksheet("جلسات", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "عنوان", key: "title", width: 38 },
    { header: "تاریخ", key: "date", width: 22 },
    { header: "ساعت شروع", key: "time", width: 12 },
    { header: "مدت (دقیقه)", key: "dur", width: 12 },
    { header: "وضعیت", key: "status", width: 16 },
    { header: "نوع", key: "type", width: 10 },
    { header: "شعبه", key: "branch", width: 18 },
    { header: "اتاق", key: "room", width: 16 },
    { header: "برگزارکننده", key: "organizer", width: 20 },
    { header: "شرکت‌کننده", key: "participants", width: 11 },
    { header: "مهمان", key: "guests", width: 9 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF1F4" } };

  for (const r of rows) {
    ws.addRow({
      title: r.title,
      date: formatJalali(r.startAt, { monthName: true }),
      time: r.startAt.toISOString().slice(11, 16),
      dur: r.durationMin,
      status: STATUS_FA[r.status] ?? r.status,
      type: TYPE_FA[r.type] ?? r.type,
      branch: r.branch,
      room: r.room,
      organizer: r.organizer,
      participants: r.participants,
      guests: r.guests,
    });
  }

  const sum = wb.addWorksheet("خلاصه", { views: [{ rightToLeft: true }] });
  sum.columns = [
    { header: "شاخص", key: "k", width: 30 },
    { header: "مقدار", key: "v", width: 24 },
  ];
  sum.getRow(1).font = { bold: true };
  const totalHours = (rows.reduce((a, b) => a + b.durationMin, 0) / 60).toFixed(1);
  const cancelled = rows.filter((r) => r.status === "CANCELLED").length;
  sum.addRow({ k: "تعداد جلسات", v: faNum(rows.length) });
  sum.addRow({ k: "مجموع ساعت", v: faNum(totalHours) });
  sum.addRow({ k: "لغو‌شده", v: faNum(cancelled) });
  sum.addRow({
    k: "بازه",
    v: `${meta.from ? formatJalali(meta.from, { monthName: true }) : "—"} تا ${meta.to ? formatJalali(meta.to, { monthName: true }) : "—"}`,
  });
  sum.addRow({ k: "تاریخ تهیه", v: formatJalali(new Date(), { monthName: true, withTime: true }) });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/* ── PDF (RTL) ─────────────────────────────────────────────── */

const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");

export async function meetingsPdf(rows: MeetingRow[], meta: ExportMeta): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, lang: "fa" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.registerFont("vazir", path.join(FONTS_DIR, "Vazirmatn-Regular.ttf"));
      doc.registerFont("vazir-bold", path.join(FONTS_DIR, "Vazirmatn-Bold.ttf"));

      const W = doc.page.width - 72; // content width
      const R = doc.page.width - 36; // right margin (RTL start)

      const rtl = (s: string) => s; // Vazirmatn glyphs are already RTL-ordered via shaping in pdfkit's fontkit

      // header
      doc.font("vazir-bold").fontSize(16).fillColor("#0d0d0d");
      doc.text(rtl("گزارش جلسات — مهرسا"), 36, 36, { width: W, align: "right" });
      doc.font("vazir").fontSize(9).fillColor("#52525b");
      const range = `${meta.from ? formatJalali(meta.from, { monthName: true }) : "—"} تا ${meta.to ? formatJalali(meta.to, { monthName: true }) : "—"}`;
      doc.text(rtl(`بازه: ${range} · ${faNum(rows.length)} جلسه · تهیه: ${formatJalali(new Date(), { monthName: true, withTime: true })}`), { width: W, align: "right" });
      doc.moveDown(1);
      doc.moveTo(36, doc.y).lineTo(R, doc.y).lineWidth(1).strokeColor("#e4e4e7").stroke();
      doc.moveDown(0.8);

      // table layout (RTL columns from right)
      const cols: { key: string; label: string; w: number }[] = [
        { key: "title", label: "عنوان", w: 200 },
        { key: "date", label: "تاریخ", w: 95 },
        { key: "time", label: "شروع", w: 48 },
        { key: "dur", label: "دقیقه", w: 46 },
        { key: "status", label: "وضعیت", w: 78 },
        { key: "branch", label: "شعبه", w: 92 },
        { key: "room", label: "اتاق", w: 78 },
        { key: "organizer", label: "برگزارکننده", w: 110 },
        { key: "people", label: "نفرات", w: 55 },
      ];

      const rowH = 22;
      let y = doc.y;

      const drawHeader = () => {
        doc.font("vazir-bold").fontSize(8.5).fillColor("#0d0d0d");
        let x = R;
        for (const c of cols) {
          doc.text(c.label, x - c.w, y + 5, { width: c.w - 6, align: "right", lineBreak: false });
          x -= c.w;
        }
        y += rowH;
        doc.moveTo(36, y - 3).lineTo(R, y - 3).lineWidth(0.7).strokeColor("#d4d4d8").stroke();
      };
      drawHeader();

      doc.font("vazir").fontSize(8.5);
      for (const r of rows) {
        if (y > doc.page.height - 60) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 36 });
          y = 40;
          drawHeader();
          doc.font("vazir").fontSize(8.5);
        }
        const cells = [
          r.title,
          formatJalali(r.startAt, { monthName: true }),
          r.startAt.toISOString().slice(11, 16),
          faNum(r.durationMin),
          STATUS_FA[r.status] ?? r.status,
          r.branch,
          r.room,
          r.organizer,
          `${faNum(r.participants)}+${faNum(r.guests)}`,
        ];
        let x = R;
        cells.forEach((val, i) => {
          const c = cols[i];
          doc.fillColor(r.status === "CANCELLED" ? "#a1a1aa" : "#27272a");
          doc.text(String(val), x - c.w, y + 5, { width: c.w - 6, align: "right", lineBreak: false, ellipsis: true, height: rowH - 8 });
          x -= c.w;
        });
        y += rowH;
        doc.moveTo(36, y - 3).lineTo(R, y - 3).lineWidth(0.4).strokeColor("#f0f0f2").stroke();
      }

      // footer summary
      const totalHours = (rows.reduce((a, b) => a + b.durationMin, 0) / 60).toFixed(1);
      doc.moveUp();
      doc.font("vazir").fontSize(9).fillColor("#52525b");
      doc.text(
        rtl(`جمع: ${faNum(rows.length)} جلسه · ${faNum(totalHours)} ساعت`),
        36,
        doc.page.height - 40,
        { width: W, align: "right" },
      );

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}
