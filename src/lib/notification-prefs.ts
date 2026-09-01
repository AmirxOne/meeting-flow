export const NOTIF_EVENTS = ["invite", "reminder", "reschedule"] as const;
export type NotifEvent = (typeof NOTIF_EVENTS)[number];

export const NOTIF_CHANNELS = ["IN_APP", "SMS", "EMAIL", "PUSH"] as const;
export type NotifChannel = (typeof NOTIF_CHANNELS)[number];

export type NotifPrefMatrix = Partial<Record<NotifEvent, Partial<Record<NotifChannel, boolean>>>>;

export const NOTIF_EVENT_FA: Record<NotifEvent, string> = {
  invite: "دعوت",
  reminder: "یادآور",
  reschedule: "تغییر زمان",
};

export const NOTIF_CHANNEL_FA: Record<NotifChannel, string> = {
  IN_APP: "درون‌سامانه",
  SMS: "پیامک",
  EMAIL: "ایمیل",
  PUSH: "پوش",
};

/** Parse REMINDER_CHANNELS env (comma-separated). Default: IN_APP only. */
export function parseOrgNotifChannels(raw?: string): NotifChannel[] {
  const source = raw ?? process.env.REMINDER_CHANNELS;
  if (!source?.trim()) return ["IN_APP"];
  const parsed = source
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((c): c is NotifChannel => (NOTIF_CHANNELS as readonly string[]).includes(c));
  return parsed.length ? [...new Set(parsed)] : ["IN_APP"];
}

/** Channels the org actually offers. IN_APP is always listed so دعوت/تغییر زمان در محصول باقی می‌ماند. */
export function availableNotifChannels(orgChannels: readonly string[]): NotifChannel[] {
  const set = new Set<NotifChannel>(["IN_APP"]);
  for (const c of orgChannels) {
    if ((NOTIF_CHANNELS as readonly string[]).includes(c)) set.add(c as NotifChannel);
  }
  return NOTIF_CHANNELS.filter((c) => set.has(c));
}

export function parseStoredNotifPrefs(raw: unknown): NotifPrefMatrix {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NotifPrefMatrix = {};
  for (const event of NOTIF_EVENTS) {
    const row = (raw as Record<string, unknown>)[event];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const channels: Partial<Record<NotifChannel, boolean>> = {};
    for (const ch of NOTIF_CHANNELS) {
      const v = (row as Record<string, unknown>)[ch];
      if (typeof v === "boolean") channels[ch] = v;
    }
    if (Object.keys(channels).length) out[event] = channels;
  }
  return out;
}

export function mergeNotifPrefs(current: NotifPrefMatrix, patch: NotifPrefMatrix): NotifPrefMatrix {
  const out: NotifPrefMatrix = { ...current };
  for (const event of NOTIF_EVENTS) {
    const row = patch[event];
    if (!row) continue;
    const next: Partial<Record<NotifChannel, boolean>> = { ...(out[event] ?? {}) };
    for (const ch of NOTIF_CHANNELS) {
      if (typeof row[ch] === "boolean") next[ch] = row[ch];
    }
    out[event] = next;
  }
  return out;
}

export function isNotifChannelEnabled(input: {
  prefs: NotifPrefMatrix | null | undefined;
  event: NotifEvent;
  channel: string;
  orgChannels: readonly string[];
  hasPhone?: boolean;
  hasEmail?: boolean;
  hasPush?: boolean;
}): boolean {
  const channel = input.channel as NotifChannel;
  if (!(NOTIF_CHANNELS as readonly string[]).includes(channel)) return false;

  const available = availableNotifChannels(input.orgChannels);
  if (!available.includes(channel)) return false;

  if (channel === "SMS" && !input.hasPhone) return false;
  if (channel === "EMAIL" && !input.hasEmail) return false;
  if (channel === "PUSH" && input.hasPush === false) return false;

  const explicit = input.prefs?.[input.event]?.[channel];
  if (explicit === false) return false;
  return true;
}

export function channelUnavailableReason(input: {
  channel: NotifChannel;
  hasPhone: boolean;
  hasEmail: boolean;
  hasPush: boolean;
}): string | null {
  if (input.channel === "SMS" && !input.hasPhone) return "شماره تلفن در پروفایل ثبت نشده";
  if (input.channel === "EMAIL" && !input.hasEmail) return "ایمیل برای این حساب ثبت نشده";
  if (input.channel === "PUSH" && !input.hasPush) return "اعلان پوش مرورگر هنوز فعال نشده";
  return null;
}

/** Default-on matrix for UI: org channels on, unless the user turned a cell off. */
export function resolvedNotifMatrix(input: {
  prefs: NotifPrefMatrix;
  orgChannels: readonly string[];
  hasPhone: boolean;
  hasEmail: boolean;
  hasPush: boolean;
}): Record<NotifEvent, Record<NotifChannel, boolean>> {
  const available = availableNotifChannels(input.orgChannels);
  const matrix = {} as Record<NotifEvent, Record<NotifChannel, boolean>>;
  for (const event of NOTIF_EVENTS) {
    matrix[event] = {} as Record<NotifChannel, boolean>;
    for (const channel of NOTIF_CHANNELS) {
      if (!available.includes(channel)) {
        matrix[event][channel] = false;
        continue;
      }
      matrix[event][channel] = isNotifChannelEnabled({
        prefs: input.prefs,
        event,
        channel,
        orgChannels: input.orgChannels,
        hasPhone: input.hasPhone,
        hasEmail: input.hasEmail,
        hasPush: input.hasPush,
      });
    }
  }
  return matrix;
}

export function buildNotifPrefsView(input: {
  prefs: NotifPrefMatrix;
  orgChannels: readonly string[];
  hasPhone: boolean;
  hasEmail: boolean;
  hasPush: boolean;
}): {
  orgChannels: string[];
  channels: NotifChannel[];
  hasPhone: boolean;
  hasEmail: boolean;
  hasPush: boolean;
  matrix: Record<NotifEvent, Record<NotifChannel, boolean>>;
  reasons: Partial<Record<NotifChannel, string | null>>;
} {
  const channels = availableNotifChannels(input.orgChannels);
  const reasons: Partial<Record<NotifChannel, string | null>> = {};
  for (const channel of channels) {
    reasons[channel] = channelUnavailableReason({
      channel,
      hasPhone: input.hasPhone,
      hasEmail: input.hasEmail,
      hasPush: input.hasPush,
    });
  }
  return {
    orgChannels: [...input.orgChannels],
    channels,
    hasPhone: input.hasPhone,
    hasEmail: input.hasEmail,
    hasPush: input.hasPush,
    matrix: resolvedNotifMatrix(input),
    reasons,
  };
}

export function filterIdsForChannel<T extends { id: string; phone?: string | null; email?: string | null }>(
  users: T[],
  input: {
    prefsByUser: Map<string, NotifPrefMatrix>;
    event: NotifEvent;
    channel: NotifChannel;
    orgChannels: readonly string[];
    pushUserIds?: Set<string>;
  },
): string[] {
  return users
    .filter((u) =>
      isNotifChannelEnabled({
        prefs: input.prefsByUser.get(u.id),
        event: input.event,
        channel: input.channel,
        orgChannels: input.orgChannels,
        hasPhone: !!u.phone,
        hasEmail: !!u.email,
        hasPush: input.pushUserIds ? input.pushUserIds.has(u.id) : undefined,
      }),
    )
    .map((u) => u.id);
}
