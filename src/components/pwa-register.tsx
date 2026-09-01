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
}
