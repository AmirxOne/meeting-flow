import Link from "next/link";
import Image from "next/image";
import type { LegalDocument } from "@/lib/legal-content";
import { faStr } from "@/lib/fa";
import { LegalFooterLinks } from "./legal-footer-links";

export function LegalPageShell({ doc }: { doc: LegalDocument }) {
  return (
    <div className="min-h-screen bg-paper-soft">
      <header className="border-b border-line bg-white px-5 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 text-ink transition hover:opacity-80">
            <Image src="/logo-white.png" alt="" width={28} height={28} className="rounded-lg bg-ink p-1" />
            <span className="text-[14px] font-bold">مهرسا</span>
          </Link>
          <Link href="/login" className="text-[12px] text-ink-soft transition hover:text-ink">
            ورود
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <article className="rounded-2xl border border-line bg-white px-6 py-8 sm:px-10">
          <p className="text-[11px] text-ink-faint">
            آخرین به‌روزرسانی: {faStr(doc.updatedAt)}
          </p>
          <h1 className="mt-2 text-[26px] font-bold leading-snug">{doc.title}</h1>
          <p className="mt-3 text-[13px] leading-7 text-ink-soft">{doc.subtitle}</p>

          <div className="mt-10 space-y-9">
            {doc.sections.map((section) => (
              <section key={section.id ?? section.title} id={section.id}>
                <h2 className="text-[16px] font-bold text-ink">{section.title}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)} className="mt-3 text-[13px] leading-8 text-ink-soft">
                    {p}
                  </p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="mt-3 list-disc space-y-2 pr-5 text-[13px] leading-7 text-ink-soft marker:text-ink-faint">
                    {section.bullets.map((item) => (
                      <li key={item.slice(0, 48)}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-line pt-6">
            <LegalFooterLinks />
          </div>
        </article>
      </main>
    </div>
  );
}
