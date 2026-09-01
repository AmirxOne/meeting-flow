export const VIDEO_PROVIDERS = ["GOOGLE_MEET", "TEAMS", "ZOOM", "CUSTOM"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const VIDEO_PROVIDER_FA: Record<VideoProvider, string> = {
  GOOGLE_MEET: "گوگل میت",
  TEAMS: "مایکروسافت تیمز",
  ZOOM: "زوم",
  CUSTOM: "لینک سفارشی",
};

export const VIDEO_PROVIDER_OPTIONS = VIDEO_PROVIDERS.map((value) => ({
  value,
  label: VIDEO_PROVIDER_FA[value],
}));

const HOST_RULES: Record<Exclude<VideoProvider, "CUSTOM">, (host: string) => boolean> = {
  GOOGLE_MEET: (h) => h === "meet.google.com" || h.endsWith(".meet.google.com"),
  TEAMS: (h) =>
    h === "teams.microsoft.com" ||
    h.endsWith(".teams.microsoft.com") ||
    h === "teams.live.com" ||
    h.endsWith(".teams.live.com"),
  ZOOM: (h) => h === "zoom.us" || h.endsWith(".zoom.us"),
};

export function isVideoProvider(value: string | null | undefined): value is VideoProvider {
  return !!value && (VIDEO_PROVIDERS as readonly string[]).includes(value);
}

/** Parse http(s) URL; rejects javascript:, data:, and relative strings. */
export function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

export function videoUrlMatchesProvider(url: URL, provider: VideoProvider): boolean {
  if (provider === "CUSTOM") return true;
  const host = url.hostname.toLowerCase();
  return HOST_RULES[provider](host);
}

export interface NormalizedVideoLink {
  videoProvider: VideoProvider | null;
  videoUrl: string | null;
}

export function normalizeVideoLink(
  provider: string | null | undefined,
  url: string | null | undefined,
): NormalizedVideoLink {
  const trimmed = (url ?? "").trim();
  if (!trimmed && !provider) return { videoProvider: null, videoUrl: null };
  if (!trimmed) return { videoProvider: isVideoProvider(provider) ? provider : "CUSTOM", videoUrl: null };
  const parsed = parseHttpUrl(trimmed);
  const kind: VideoProvider = isVideoProvider(provider) ? provider : "CUSTOM";
  return { videoProvider: kind, videoUrl: parsed ? parsed.toString() : trimmed };
}

export function validateVideoLink(
  provider: string | null | undefined,
  url: string | null | undefined,
): { ok: true; value: NormalizedVideoLink } | { ok: false; message: string } {
  const trimmed = (url ?? "").trim();
  const hasProvider = !!provider && provider !== "";
  if (!trimmed && !hasProvider) {
    return { ok: true, value: { videoProvider: null, videoUrl: null } };
  }
  if (!trimmed) {
    return { ok: false, message: "لینک ویدئو را وارد کنید" };
  }
  if (trimmed.length > 500) {
    return { ok: false, message: "لینک ویدئو حداکثر ۵۰۰ کاراکتر است" };
  }
  const parsed = parseHttpUrl(trimmed);
  if (!parsed) {
    return { ok: false, message: "لینک ویدئو نامعتبر است — باید با http یا https شروع شود" };
  }
  const kind: VideoProvider = isVideoProvider(provider) ? provider : "CUSTOM";
  if (!videoUrlMatchesProvider(parsed, kind)) {
    return {
      ok: false,
      message: `این آدرس با «${VIDEO_PROVIDER_FA[kind]}» هم‌خوان نیست`,
    };
  }
  return {
    ok: true,
    value: { videoProvider: kind, videoUrl: parsed.toString() },
  };
}

export function formatVideoInviteLine(
  provider: string | null | undefined,
  url: string,
): string {
  const label = isVideoProvider(provider) ? VIDEO_PROVIDER_FA[provider] : VIDEO_PROVIDER_FA.CUSTOM;
  return `لینک ویدئو (${label}): ${url}`;
}

export function mergeTextWithVideoLink(
  text: string | null | undefined,
  provider: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const base = text?.trim() ?? "";
  const video = url?.trim() ?? "";
  if (!video) return base || null;
  const line = formatVideoInviteLine(provider, video);
  return base ? `${base}\n\n${line}` : line;
}
