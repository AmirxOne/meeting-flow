"use client";

import { useEffect } from "react";

/** Registers the App Shell service worker (`/sw.js`). No-op without SW support. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(id);
  }, []);
  return null;

  // remember the intended navigation when SW serves the offline page
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.serviceWorker) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "OFFLINE_NAV" && e.data.url) {
        try { sessionStorage.setItem("mehrsa-offline-back", e.data.url); } catch {}
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
}
