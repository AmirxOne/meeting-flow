"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, X, Plus, Pencil, Trash2, ExternalLink } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-modal";
import { cn, faNum } from "@/lib";

interface SafeProvider {
  id: string;
  specId: string;
  name: string;
  baseUrl: string;
  model: string | null;
  enabled: boolean;
  updatedAt: string;
  apiKeyMasked: string;
}

interface ActiveSettings {
  activeProviderId: string | null;
  fallbackProviderId: string | null;
  temperature: number;
  maxTokens: number;
}

interface Spec {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  defaultModel: string | null;
  models: string[];
  docsUrl?: string;
}

/** کارت مدیریت پروایدرهای AI — کلید API فقط هنگام ثبت تایپ می‌شود و هرگز نمایش داده نمی‌شود. */
export function AiProvidersCard() {
  const qc = useQueryClient();
  const { push } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SafeProvider | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api<{ providers: SafeProvider[]; specs: Spec[] }>("/api/admin/ai-providers"),
  });

  const settingsQ = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => api<{ settings: ActiveSettings }>("/api/admin/ai-providers/settings"),
  });
  const activeSettings = settingsQ.data?.settings;

  const saveSettings = (patch: Partial<ActiveSettings>) => {
    api("/api/admin/ai-providers/settings", { method: "POST", json: patch })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["ai-settings"] });
        push("تنظیمات هوش مصنوعی ذخیره شد", "success");
      })
      .catch((e) => push((e as ApiError).message ?? "ذخیره ناموفق", "error"));
  };

  const testMut = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; detail: string }>("/api/admin/ai-providers/test", { method: "POST", json: { id } }),
    onSuccess: (r) => push(r.ok ? `اتصال برقرار است — ${r.detail}` : `تست ناموفق: ${r.detail}`, r.ok ? "success" : "error"),
    onError: (e) => push((e as ApiError).message ?? "تست ناموفق", "error"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/ai-providers`, { method: "DELETE", json: { id } }),
    onSuccess: () => {
      push("پروایدر حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["ai-providers"] });
    },
    onError: (e) => push((e as ApiError).message ?? "حذف ناموفق", "error"),
  });

  const specs = data?.specs ?? [];
  const providers = data?.providers ?? [];

  async function remove(p: SafeProvider) {
    const ok = await confirm({
      title: `حذف پروایدر «${p.name}»؟`,
      body: "قابلیت‌های AI متصل به این پروایدر از کار می‌افتند. کلید API هم حذف می‌شود.",
      confirmLabel: "حذف کن",
      danger: true,
    });
    if (ok) delMut.mutate(p.id);
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            پروایدرهای هوش مصنوعی
          </span>
        }
        subtitle="کلیدهای API رمزنگاری‌شده ذخیره می‌شوند و هرگز نمایش داده نمی‌شوند"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            افزودن پروایدر
          </Button>
        }
      />
      {/* پروایدر فعال + fallback — الگوی استاندارد: همه‌ی قابلیت‌های AI از همین دو می‌خوانند */}
      {providers.length > 0 && (
        <div className="grid gap-3 border-b border-line bg-paper-soft/40 px-5 py-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft">پروایدر فعال (پیش‌فرض)</label>
            <Select
              value={activeSettings?.activeProviderId ?? ""}
              onChange={(v) => saveSettings({ activeProviderId: v || null })}
              placeholder="اولین پروایدرِ فعال"
              options={providers.map((p) => ({ value: p.id, label: `${p.name}${p.model ? ` · ${p.model}` : ""}`, hint: p.enabled ? undefined : "غیرفعال" }))}
            />
            <p className="mt-1 text-[10.5px] text-ink-faint">همه‌ی قابلیت‌های AI از این پروایدر استفاده می‌کنند</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-ink-soft">پروایدر پشتیبان (fallback)</label>
            <Select
              value={activeSettings?.fallbackProviderId ?? ""}
              onChange={(v) => saveSettings({ fallbackProviderId: v || null })}
              placeholder="بدون پشتیبان"
              options={providers.map((p) => ({ value: p.id, label: `${p.name}${p.model ? ` · ${p.model}` : ""}` }))}
            />
            <p className="mt-1 text-[10.5px] text-ink-faint">اگر فعال محدود شد (۴۲۹/۵۰۳) درخواست خودکار به این می‌رود</p>
          </div>
        </div>
      )}
      <div className="p-5 pt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <SkeletonBlock key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            title="هنوز پروایدری ثبت نشده"
            action={
              <Button size="sm" className="mt-2" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                افزودن پروایدر
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {providers.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper-soft/40 px-3.5 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    p.enabled ? "bg-ink text-white" : "bg-line text-ink-faint",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    {p.name}
                    <span className={cn("badge", p.enabled ? "badge-green" : "badge-gray")}>
                      {p.enabled ? "فعال" : "غیرفعال"}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-soft" dir="ltr">
                    {p.baseUrl}{p.model ? ` · ${p.model}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-ink-faint">
                    کلید: <span dir="ltr" className="font-mono">{p.apiKeyMasked}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="outline" loading={testMut.isPending && testMut.variables === p.id} onClick={() => testMut.mutate(p.id)}>
                    تست اتصال
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="hover:border-danger/40 hover:text-danger" onClick={() => remove(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10.5px] leading-5 text-ink-faint">
          امنیت: کلیدها با AES-256-GCM رمزنگاری و فقط روی سرور باز می‌شوند؛ در پاسخ API، لاگ ممیزی و شبکه‌ی مرورگر ظاهر نمی‌شوند. برای هر پروایدر فقط ۴ حرف اول و آخر نمایش داده می‌شود.
        </p>
      </div>

      {(creating || editing) && (
        <ProviderForm
          specs={specs}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function ProviderForm({
  specs,
  initial,
  onClose,
}: {
  specs: Spec[];
  initial: SafeProvider | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [specId, setSpecId] = useState(initial?.specId ?? "zai");
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const { push: pushToast } = useToast();

  async function discoverModels() {
    setDiscovering(true);
    try {
      const r = await api<{ models: string[] }>("/api/admin/ai-providers/models", {
        method: "POST",
        json: {
          ...(initial?.id ? { providerId: initial.id } : {}),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : initial?.id ? {} : {}),
          specId,
          baseUrl: baseUrl.trim() || spec?.baseUrl || "",
        },
      });
      setDiscovered(r.models);
      pushToast(
        r.models.length
          ? `${faNum(r.models.length)} مدل پیدا شد — از لیست انتخاب کنید`
          : "پروایدر مدلی برنگرداند — دستی وارد کنید",
        r.models.length ? "success" : "error",
      );
    } catch (e) {
      pushToast((e as ApiError).message ?? "دریافت مدل‌ها ناموفق بود", "error");
    } finally {
      setDiscovering(false);
    }
  }

  const spec = specs.find((s) => s.id === specId);
  const effectiveBase = baseUrl || spec?.baseUrl || "";
  const effectiveModel = model || spec?.defaultModel || "";

  const save = useMutation({
    mutationFn: () =>
      api("/api/admin/ai-providers", {
        method: "POST",
        json: {
          id: initial?.id,
          specId,
          name,
          baseUrl: effectiveBase,
          model: effectiveModel || null,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          enabled,
        },
      }),
    onSuccess: () => {
      push(initial ? "پروایدر به‌روز شد" : "پروایدر ثبت شد", "success");
      qc.invalidateQueries({ queryKey: ["ai-providers"] });
      onClose();
    },
    onError: (e) => push((e as ApiError).message ?? "ثبت ناموفق", "error"),
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
        <div
          className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[14px] font-bold">{initial ? `ویرایش «${initial.name}»` : "افزودن پروایدر هوش مصنوعی"}</p>
          <p className="mt-1 text-[11.5px] text-ink-soft">کلید فقط هنگام ثبت ارسال می‌شود؛ خالی بگذارید تا تغییر نکند.</p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">پروایدر</label>
              <Select
                value={specId}
                onChange={(v) => {
                  setSpecId(v);
                  setBaseUrl("");
                  setModel("");
                }}
                options={specs.map((s) => ({ value: s.id, label: s.name }))}
              />
              {spec?.docsUrl && (
                <a href={spec.docsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-ink-faint hover:text-ink">
                  مستندات <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-ink-soft">نام نمایشی</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={spec?.name ?? "مثلاً: GLM تولیدی"}
                  name="ai-provider-display-name"
                  autoComplete="off"
                  readOnly={false}
                  className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-[11px] text-ink-soft">
                  <span>مدل</span>
                </label>
                {discovered.length > 0 ? (
                  <Select
                    value={model || discovered[discovered.length - 1]}
                    onChange={(v) => setModel(v)}
                    options={discovered.map((m) => ({ value: m, label: m }))}
                  />
                ) : (
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={spec?.defaultModel ?? "مثلاً glm-4.7"}
                    name="ai-provider-model"
                    autoComplete="off"
                    className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={discovering}
                  onClick={discoverModels}
                  className="w-full"
                >
                  دریافت خودکار مدل‌ها از پروایدر
                </Button>
                {discovered.length === 0 && (spec?.models?.length ?? 0) > 0 && (
                  <p className="mt-1.5 text-[10.5px] text-ink-faint">
                    مدل‌های پیشنهادی {spec?.name}: {spec?.models?.join("، ")}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">آدرس پایه (Base URL)</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={spec?.baseUrl || "https://..."}
                dir="ltr"
                name="ai-provider-base-url"
                autoComplete="url"
                spellCheck={false}
                className="h-10 w-full rounded-md border border-line px-3 font-mono text-[11.5px] outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-ink-soft">
                کلید API {initial && <span className="text-ink-faint">(فعلی: <span dir="ltr" className="font-mono">{initial.apiKeyMasked}</span>)</span>}
              </label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                name="ai-provider-api-key"
                autoComplete="new-password"
                placeholder={initial ? "برای تغییر، کلید جدید را وارد کنید" : "کلید API پروایدر"}
                dir="ltr"
                className="h-10 w-full rounded-md border border-line px-3 font-mono text-[11.5px] outline-none focus:border-ink"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[12px]">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-black" />
              فعال باشد
            </label>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              انصراف
            </Button>
            <Button
              className="flex-1"
              loading={save.isPending}
              disabled={!initial && !apiKey.trim()}
              onClick={() => save.mutate()}
            >
              <Check className="h-4 w-4" />
              {initial ? "ذخیره تغییرات" : "ثبت پروایدر"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
