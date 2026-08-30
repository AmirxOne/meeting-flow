/**
 * Pull linear SVGs from the official `iconsax` package (iconsax.io)
 * into src/lib/iconsax-glyphs.ts — only the names the app uses.
 */
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules/iconsax/dist");

if (!existsSync(join(pkg, "manifest.json"))) {
  console.error("[iconsax] package missing — run pnpm add iconsax");
  process.exit(1);
}

const manifest = require(join(pkg, "manifest.json"));

/** Lucide-era export name → official Iconsax free icon name */
export const ICON_MAP = {
  Activity: "activity",
  AlertCircle: "danger",
  ArrowLeft: "arrow-left-01",
  Ban: "forbidden",
  BarChart3: "chart-2",
  Bell: "notification",
  Briefcase: "briefcase",
  Building2: "buildings",
  CalendarClock: "calendar-2",
  CalendarDays: "calendar",
  CalendarPlus: "calendar-add",
  CalendarX2: "calendar-remove",
  Check: "tick-circle",
  CheckCheck: "tick-square",
  CheckCircle2: "tick-circle",
  ChevronDown: "arrow-down-02",
  ChevronLeft: "arrow-left-02",
  ChevronRight: "arrow-right-02",
  ChevronUp: "arrow-up-02",
  Clock: "clock",
  Contact: "personalcard",
  Copy: "copy",
  DoorOpen: "house",
  Download: "document-download",
  ExternalLink: "link-2",
  History: "refresh-circle",
  Hourglass: "hourglass",
  Info: "info-circle",
  KeyRound: "key",
  Layers: "layer",
  LayoutDashboard: "category",
  LifeBuoy: "lifebuoy",
  MessageQuestion: "message-question",
  Loader2: "rotate-right",
  LogOut: "logout-01",
  MapPin: "location",
  Menu: "menu",
  MessageCircle: "message-text",
  Pencil: "edit-2",
  Phone: "call",
  Play: "play",
  PlayCircle: "play-circle",
  Plus: "add",
  Power: "toggle-on-circle",
  Printer: "printer",
  ScrollText: "document-text",
  Search: "search-normal",
  Settings: "setting-2",
  Settings2: "setting-4",
  Shield: "shield",
  ShieldCheck: "shield-tick",
  SlidersHorizontal: "slider-horizontal",
  Sparkles: "magic-star",
  Square: "stop",
  Trash2: "trash",
  User: "user",
  UserCheck: "user-tick",
  UserCircle: "profile-circle",
  UserPlus: "user-add",
  UserRound: "user",
  UserX: "user-remove",
  Users: "people",
  UsersRound: "profile-2user",
  Wrench: "broom",
  X: "close-circle",
  XCircle: "close-circle",
};

function pickSvg(name) {
  const meta = manifest[name];
  if (!meta) throw new Error(`Iconsax has no free icon "${name}"`);
  const data = require(join(pkg, "data", `${meta.category}.json`));
  const styles = data[name] || {};
  const svg = styles.linear || styles.outline || styles[meta.styles[0]];
  if (!svg) throw new Error(`No usable style for "${name}"`);
  return svg
    .replace(/\swidth="[^"]*"/, ' width="1em"')
    .replace(/\sheight="[^"]*"/, ' height="1em"')
    .replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="currentColor"');
}

const glyphs = {};
for (const ix of [...new Set(Object.values(ICON_MAP))]) {
  glyphs[ix] = pickSvg(ix);
}

const pkgJson = require(join(pkg, "../package.json"));
const out = `/* AUTO-GENERATED from official iconsax@${pkgJson.version} (iconsax.io). Do not edit. */
export const ICONSAX_MAP = ${JSON.stringify(ICON_MAP, null, 2)} as const;

export type IconName = keyof typeof ICONSAX_MAP;
export type IconsaxId = (typeof ICONSAX_MAP)[IconName];

export const ICONSAX_GLYPHS: Record<IconsaxId, string> = ${JSON.stringify(glyphs, null, 2)};
`;

const dest = join(root, "src/lib/iconsax-glyphs.ts");
writeFileSync(dest, out);
console.log(`[iconsax] wrote ${Object.keys(glyphs).length} glyphs → src/lib/iconsax-glyphs.ts`);
