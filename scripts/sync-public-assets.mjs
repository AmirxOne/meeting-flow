/**
 * Copy Vazirmatn webfonts from the npm package into public/fonts/.
 * Keeps committed assets in sync after `pnpm install` / vazirmatn version bumps.
 */
import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontSrc = join(root, "node_modules/vazirmatn/fonts/webfonts");
const fontDst = join(root, "public/fonts");

const FONTS = [
  "Vazirmatn-Regular.woff2",
  "Vazirmatn-Medium.woff2",
  "Vazirmatn-Bold.woff2",
];

if (!existsSync(fontSrc)) {
  console.warn("[assets] vazirmatn not installed — skip font sync (run pnpm install)");
  process.exit(0);
}

mkdirSync(fontDst, { recursive: true });

let copied = 0;
for (const file of FONTS) {
  const src = join(fontSrc, file);
  const dst = join(fontDst, file);
  if (!existsSync(src)) {
    console.error(`[assets] missing ${src}`);
    process.exit(1);
  }
  cpSync(src, dst);
  copied += 1;
}

const logo = join(root, "public/logo-white.png");
if (!existsSync(logo) || statSync(logo).size < 100) {
  console.error("[assets] public/logo-white.png missing or invalid — add the Mehrsa logo");
  process.exit(1);
}

console.log(`[assets] synced ${copied} Vazirmatn fonts → public/fonts/`);
