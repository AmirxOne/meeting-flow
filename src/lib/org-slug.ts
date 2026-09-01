/** Tenant slug: subdomain, `?org=`, cookie, or login body. */

export const SAMPLE_ORG_SLUG = "sample";
export const SAMPLE_ORG_ID = "org-main";
export const ORG_COOKIE = "mh_org";
export const ORG_SLUG_HEADER = "x-org-slug";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function normalizeOrgSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!SLUG_RE.test(s)) return null;
  return s;
}

/** `beta.localhost` / `sample.app.example.com` → slug. Bare localhost / apex host → null. */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname) return null;

  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    if (!sub || sub === "www") return null;
    return normalizeOrgSlug(sub);
  }

  const parts = hostname.split(".").filter(Boolean);
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!sub || sub === "www") return null;
    return normalizeOrgSlug(sub);
  }
  return null;
}

export function requestedOrgSlug(input: {
  header?: string | null;
  query?: string | null;
  host?: string | null;
  cookie?: string | null;
}): string | null {
  return (
    normalizeOrgSlug(input.header) ??
    normalizeOrgSlug(input.query) ??
    slugFromHost(input.host) ??
    normalizeOrgSlug(input.cookie)
  );
}

const FA_TO_LATIN: Record<string, string> = {
  ا: "a", آ: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh",
  د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t",
  ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n",
  و: "o", ه: "h", ی: "y", ئ: "y", ء: "", " ": "-", "_": "-",
};

/** Suggest an ASCII slug from org display name (Persian/Latin). */
export function proposeOrgSlug(name: string): string {
  const raw = name.trim().toLowerCase();
  if (!raw) return "";

  let out = "";
  for (const ch of raw) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === " " || ch === "-" || ch === "_") out += "-";
    else if (FA_TO_LATIN[ch]) out += FA_TO_LATIN[ch];
  }

  out = out
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (out.length >= 2 && SLUG_RE.test(out)) return out.slice(0, 48);
  if (/^[a-z0-9]/.test(out)) return out.slice(0, 48);
  return "";
}
