"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "@/components/ui/icon";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}
interface ToastCtx {
  push: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastCtx>({ push: () => {} });
export const useToast = () => useContext(Ctx);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2 max-sm:right-1/2 max-sm:translate-x-1/2">
        <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="flex max-w-sm items-center gap-2 rounded-md border border-line bg-white px-4 py-3 shadow-lg"
          >
            {t.tone === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
            {t.tone === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />}
            {t.tone === "info" && <Info className="h-4 w-4 shrink-0 text-ink-soft" />}
            <span className="text-[13px]">{t.message}</span>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="mr-auto text-ink-faint hover:text-ink"
              aria-label="بستن"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
