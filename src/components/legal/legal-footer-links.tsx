"use client";

import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/privacy", label: "حریم خصوصی" },
  { href: "/terms", label: "شرایط استفاده" },
  { href: "/data-retention", label: "نگهداری داده" },
] as const;

export function LegalFooterLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-ink-soft ${className}`}
      aria-label="صفحات حقوقی"
      data-testid="legal-footer-links"
    >
      {LEGAL_LINKS.map(({ href, label }, i) => (
        <span key={href} className="inline-flex items-center gap-4">
          {i > 0 && <span className="hidden text-ink-faint sm:inline" aria-hidden>|</span>}
          <Link href={href} className="transition hover:text-ink">
            {label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
