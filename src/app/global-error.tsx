"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** Root-level fallback — renders when even the layout throws (no app shell). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "alibaba, Tahoma, system-ui, sans-serif",
          background: "#fff",
          color: "#0d0d0d",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 56, fontWeight: 700, color: "#e9e9ee", margin: 0 }}>۵۰۰</p>
          <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>خطای سیستمی رخ داد</p>
          <p
            style={{
              fontSize: 12,
              color: "#6b6b76",
              maxWidth: 380,
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            صفحه به‌طور کامل بارگذاری نشد. لطفاً دوباره تلاش کنید؛ در صورت تکرار با
            پشتیبانی تماس بگیرید.
          </p>
          {error?.digest && (
            <code style={{ fontSize: 10, color: "#9a9aa5", background: "#f4f4f6", padding: "4px 8px", borderRadius: 6 }}>
              {error.digest}
            </code>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              height: 40,
              padding: "0 22px",
              background: "#0d0d0d",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
