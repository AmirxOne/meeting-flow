import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  wrapRtlEmailHtml,
  inviteEmailTemplate,
  reminderEmailTemplate,
  minutesEmailTemplate,
  meetingAppUrl,
} from "@/lib/email-templates";

describe("escapeHtml", () => {
  it("escapes tags so titles cannot inject HTML", () => {
    expect(escapeHtml(`جلسه <script>x</script> & "y"`)).toBe(
      "جلسه &lt;script&gt;x&lt;/script&gt; &amp; &quot;y&quot;",
    );
  });
});

describe("wrapRtlEmailHtml", () => {
  it("emits a simple RTL document with heading and CTA", () => {
    const html = wrapRtlEmailHtml({
      heading: "عنوان",
      paragraphs: ["خط یک"],
      cta: { label: "مشاهده جلسه", href: "http://localhost:3100/meetings/m1" },
    });
    expect(html).toContain('lang="fa"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("عنوان");
    expect(html).toContain("خط یک");
    expect(html).toContain("مشاهده جلسه");
    expect(html).toContain("http://localhost:3100/meetings/m1");
  });
});

describe("inviteEmailTemplate", () => {
  it("builds Persian invite text and RTL html", () => {
    const tpl = inviteEmailTemplate({
      heading: "جلسه «برنامه» ایجاد شد",
      when: "شنبه ۱۲:۰۰ تا ۱۳:۰۰",
      videoLine: "لینک ویدئو (زوم): https://zoom.us/j/1",
      meetingId: "mtg1",
      appUrl: "https://mehrsa.example",
    });
    expect(tpl.subject).toContain("برنامه");
    expect(tpl.text).toContain("شنبه ۱۲:۰۰");
    expect(tpl.text).toContain("https://mehrsa.example/meetings/mtg1");
    expect(tpl.html).toContain('dir="rtl"');
    expect(tpl.html).toContain("مشاهده جلسه");
    expect(tpl.html).toContain("زوم");
  });
});

describe("reminderEmailTemplate", () => {
  it("includes Persian offset, agenda, and meeting link", () => {
    const tpl = reminderEmailTemplate({
      title: "استندآپ",
      agendaPlain: "دستور جلسه:\n۱. مرور",
      offsetMin: 10,
      meetingId: "m2",
      appUrl: "http://localhost:3100",
    });
    expect(tpl.subject).toBe("یادآوری جلسه: استندآپ");
    expect(tpl.text).toContain("۱۰ دقیقه دیگر");
    expect(tpl.text).toContain("دستور جلسه");
    expect(tpl.html).toContain("۱۰ دقیقه");
    expect(tpl.html).toContain(meetingAppUrl("m2", { APP_URL: "http://localhost:3100" }));
  });
});

describe("minutesEmailTemplate", () => {
  it("announces published minutes in RTL html", () => {
    const tpl = minutesEmailTemplate({
      title: "کمیته فروش",
      meetingId: "m3",
      appUrl: "http://localhost:3100",
    });
    expect(tpl.subject).toContain("صورتجلسه");
    expect(tpl.text).toContain("کمیته فروش");
    expect(tpl.html).toContain("مشاهده صورتجلسه");
    expect(tpl.html).toContain('dir="rtl"');
    expect(tpl.html).not.toContain("<script>");
  });
});
