"use client";

/**
 * گیت سمت کلاینت برای همه‌ی قابلیت‌های AI.
 * اگر پروایدری نباشد یا قطع باشد، دکمه/کارت AI رندر نمی‌شود —
 * کاربر حس «قابلیت خراب» نمی‌گیرد.
 *
 * const ai = useAiFeature();
 * {ai.enabled && <SummarizeButton … />}
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAiFeature() {
  const { data } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api<{ usable: boolean }>("/api/ai/status"),
    staleTime: 60_000, // یک دقیقه کش — هر صفحه‌باز شدن فوراً جواب دارد
    retry: false,
  });
  return { enabled: data?.usable === true };
}
