import Link from "next/link";
import Image from "next/image";
import type { LegalDocument } from "@/lib/legal-content";
import { faStr } from "@/lib/fa";
import { LegalFooterLinks } from "./legal-footer-links";

/** Shared professional shell for privacy / terms / data-retention pages. */
export function LegalPageShell({ doc }: { doc: LegalDocument }) {
  const firstLetter = doc.title.trim().charAt(0);
  return (
    <div dir="rtl" className="min-h-screen bg-paper-soft">
      {/* header — glass */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 text-ink transition hover:opacity-80">
            <Image src="/logo-white.png" alt="" width={28} height={28} className="rounded-lg bg-ink p-1" />
            <span className="text-[14px] font-bold">مهرسا</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/request"
              className="hidden h-9 items-center rounded-lg border border-line bg-white px-4 text-[12.5px] text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink sm:flex"
            >
              درخواست جلسه
            </Link>
            <Link
              href="/login"
              className="flex h-9 items-center rounded-lg bg-ink px-4 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
            >
              ورود
            </Link>
          </div>
        </div>
      </header>

      {/* hero band */}
      <div className="relative overflow-hidden border-b border-line bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-paper-soft opacity-70"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/4 size-72 rounded-full bg-ink/[0.05] blur-3xl" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-10 pt-12 sm:pt-14">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-[22px] font-bold text-white shadow-lg">
              {firstLetter}
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[10.5px] font-medium text-ink-soft shadow-sm">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                سند رسمی مهرسا
              </p>
              <h1 className="mt-3 text-[26px] font-bold leading-snug sm:text-[30px]">{doc.title}</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-7 text-ink-soft">{doc.subtitle}</p>
              <p className="mt-3 text-[11px] text-ink-faint">آخرین به‌روزرسانی: {faStr(doc.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* body: sticky TOC + sections */}
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
          {/* TOC (desktop) */}
          <aside className="hidden lg:block">
            <nav className="sticky top-20 space-y-1 border-r border-line pr-4">
              <p className="mb-2 text-[11px] font-bold text-ink-faint">فهرست مطالب</p>
              {doc.sections.map((s) => (
                <a
                  key={s.id ?? s.title}
                  href={s.id ? `#${s.id}` : undefined}
                  className="block rounded-lg px-2.5 py-1.5 text-[12px] leading-6 text-ink-soft transition-colors hover:bg-white hover:text-ink"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="space-y-4">
            {doc.sections.map((section, i) => (
              <section
                key={section.id ?? section.title}
                id={section.id}
                className="scroll-mt-24 rounded-2xl border border-line bg-white px-6 py-6 sm:px-8"
              >
                <div className="flex items-baseline gap-3">
                  <span className="flex size-7 shrink-0 translate-y-1 items-center justify-center rounded-lg bg-paper-soft text-[12px] font-bold tabular-nums text-ink-soft">
                    {faStr(String(i + 1))}
                  </span>
                  <h2 className="text-[16.5px] font-bold leading-8 text-ink">{section.title.replace(/^[۰-۹0-9]+.\s*/, "")}</h2>
                </div>
                <div className="mt-3 space-y-3 pr-10">
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 40)} className="text-[13px] leading-8 text-ink-soft">
                      {p}
                    </p>
                  ))}
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="space-y-2 pt-1">
                      {section.bullets.map((item) => (
                        <li key={item.slice(0, 48)} className="flex items-start gap-2.5 text-[13px] leading-7 text-ink-soft">
                          <svg viewBox="0 0 24 24" className="mt-2 size-3.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="rounded-lg bg-paper-soft/60 px-3 py-2 leading-7">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}

            <div className="rounded-2xl border border-line bg-white px-6 py-5 sm:px-8">
              <p className="text-[12px] leading-7 text-ink-soft">
                دربارهٔ بخش‌های این سند سوالی دارید؟ از طریق سامانه‌ی پشتیبانی سازمان خود با مدیر پلتفرم در تماس باشید.
              </p>
              <div className="mt-4 border-t border-line pt-4">
                <LegalFooterLinks />
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
