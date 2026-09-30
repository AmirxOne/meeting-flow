"use client";

import { create } from "zustand";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Trash2 } from "@/components/ui/icon";

/**
 * جایگزین سراسری window.confirm — مودال استایل‌دار پروژه.
 * استفاده: const confirm = useConfirm(); await confirm({ title, ... })
 */
interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  opts: ConfirmOptions | null;
  resolver: ((v: boolean) => void) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (v: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolver: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // اگر مودال قبلی باز است، اول بستهاش کنیم
      get().resolver?.(false);
      set({ open: true, opts, resolver: resolve });
    }),
  resolve: (v) => {
    get().resolver?.(v);
    set({ open: false, opts: null, resolver: null });
  },
}));

export function useConfirm() {
  return useConfirmStore((s) => s.ask);
}

/** یک بار در AppShell رندر شود */
export function ConfirmModalHost() {
  const { open, opts, resolve } = useConfirmStore();
  return (
    <Modal
      open={open}
      onClose={() => resolve(false)}
      title={opts?.title ?? ""}
      subtitle={opts?.danger ? "این عملیات قابل بازگشت نیست" : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => resolve(false)}>
            {opts?.cancelLabel ?? "انصراف"}
          </Button>
          <Button onClick={() => resolve(true)}>
            {opts?.danger && <Trash2 className="h-4 w-4" />}
            {opts?.confirmLabel ?? "تأیید"}
          </Button>
        </div>
      }
    >
      <p className="text-[13px] leading-6 text-ink-soft">{opts?.body}</p>
    </Modal>
  );
}
