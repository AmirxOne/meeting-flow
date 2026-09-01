import { faNum } from "@/lib/fa";

export const AGENDA_MAX_ITEMS = 20;
export const AGENDA_TITLE_MAX = 160;
export const AGENDA_DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90] as const;

export interface AgendaPlainItem {
  title: string;
  durationMin: number | null;
  ownerName: string | null;
}

/** Display text for ICS DESCRIPTION / reminder email (Persian digits). */
export function formatAgendaPlain(items: AgendaPlainItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((it, i) => {
    const dur = it.durationMin && it.durationMin > 0 ? ` (${faNum(it.durationMin)} دقیقه)` : "";
    const owner = it.ownerName ? ` — ${it.ownerName}` : "";
    return `${faNum(i + 1)}. ${it.title}${dur}${owner}`;
  });
  return `دستور جلسه:\n${lines.join("\n")}`;
}

export function mergeDescriptionWithAgenda(
  description: string | null | undefined,
  agendaPlain: string,
): string | null {
  const desc = description?.trim() ?? "";
  const agenda = agendaPlain.trim();
  if (!desc && !agenda) return null;
  if (!agenda) return desc;
  if (!desc) return agenda;
  return `${desc}\n\n${agenda}`;
}

export function buildReminderEmailBody(title: string, agendaPlain: string): string {
  const head = `یادآوری جلسه «${title}»`;
  const agenda = agendaPlain.trim();
  return agenda ? `${head}\n\n${agenda}` : head;
}
