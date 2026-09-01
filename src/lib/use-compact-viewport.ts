"use client";

import { useEffect, useState } from "react";

/** Tailwind `lg` is 1024px. `null` until mounted — avoid SSR/desktop flash. */
export function useCompactViewport(): boolean | null {
  const [compact, setCompact] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return compact;
}
