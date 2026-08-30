/**
 * Verify committed webfonts + logo exist in public/.
 * Alibaba fonts are vendored under public/fonts/ (not an npm package).
 */
import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontDst = join(root, "public/fonts");

const FONTS = [
  "Alibaba-Regular.woff2",
  "Alibaba-Bold.woff2",
  "Alibaba-Black.woff2",
];

let ok = 0;
for (const file of FONTS) {
  const path = join(fontDst, file);
  if (!existsSync(path) || statSync(path).size < 1000) {
    console.error(`[assets] missing or invalid ${path}`);
    process.exit(1);
  }
  ok += 1;
}

const logo = join(root, "public/logo-white.png");
if (!existsSync(logo) || statSync(logo).size < 100) {
  console.error("[assets] public/logo-white.png missing or invalid — add the Mehrsa logo");
  process.exit(1);
}

console.log(`[assets] verified ${ok} Alibaba fonts → public/fonts/`);

const extract = spawnSync(process.execPath, [join(root, "scripts/extract-iconsax.mjs")], {
  stdio: "inherit",
});
if (extract.status !== 0) process.exit(extract.status ?? 1);
