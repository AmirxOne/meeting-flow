// E2E SEO audit for public (non-login) pages — what search engines need:
// unique titles/descriptions, canonical, robots, OG, lang/dir, sitemap,
// robots.txt, JSON-LD, heading hierarchy, image alts, noindex on private pages.
const BASE = 'http://127.0.0.1:3100';

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); }
}

function getMeta(html) {
  const pick = (re) => {
    const m = html.match(re);
    return m && m[1] ? m[1] : '';
  };
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/),
    desc: pick(/<meta name="description" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/),
    robots: pick(/<meta name="robots" content="([^"]*)"/),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/),
    ogDesc: pick(/<meta property="og:description" content="([^"]*)"/),
    jsonLd: html.includes('application/ld+json'),
    h1s: (html.match(/<h1[\s>]/g) || []).length,
    imgsNoAlt: (html.match(/<img(?![^>]*alt=)[^>]*>/g) || []).length,
  };
}

const PUBLIC_PAGES = [
  { path: '/', mustTitle: 'مهرسا', wantOg: true, wantJsonLd: true, index: true },
  { path: '/request', mustTitle: 'درخواست جلسه', wantOg: true, wantJsonLd: false, index: true },
  { path: '/privacy', mustTitle: 'حریم خصوصی', wantOg: false, wantJsonLd: false, index: true },
  { path: '/terms', mustTitle: 'شرایط', wantOg: false, wantJsonLd: false, index: true },
  { path: '/data-retention', mustTitle: 'نگهداری داده', wantOg: false, wantJsonLd: false, index: true },
];

const NOINDEX_PAGES = [
  { path: '/login', mustTitle: 'ورود' },
  { path: '/dashboard', redirect: true }, // auth-gated
];

(async () => {
  // ── per-page checks
  const seenTitles = new Set();
  for (const pg of PUBLIC_PAGES) {
    const res = await fetch(`${BASE}${pg.path}`, { redirect: 'manual' });
    check(`${pg.path} 200`, res.status === 200, String(res.status));
    const html = await res.text();
    const m = getMeta(html);

    check(`${pg.path} has <title> with «${pg.mustTitle}»`, m.title.includes(pg.mustTitle), m.title.slice(0, 50));
    check(`${pg.path} title unique`, !seenTitles.has(m.title), m.title.slice(0, 50));
    seenTitles.add(m.title);
    check(`${pg.path} meta description 50..320 chars`, m.desc.length >= 50 && m.desc.length <= 320, `len=${m.desc.length}`);
    check(`${pg.path} canonical present`, m.canonical.length > 0);
    const BASEURL = 'http://localhost:3100';
    const expected = pg.path === '/' ? BASEURL : BASEURL + pg.path;
    check(`${pg.path} canonical ends with path`, m.canonical === expected || m.canonical.endsWith(pg.path), `${m.canonical} vs ${expected}`);
    if (pg.wantOg) {
      check(`${pg.path} og:title`, m.ogTitle.length > 0);
      check(`${pg.path} og:description`, m.ogDesc.length > 0);
    }
    if (pg.wantJsonLd) check(`${pg.path} JSON-LD structured data`, m.jsonLd);
    if (pg.index) check(`${pg.path} indexable (no noindex)`, !m.robots.includes('noindex'));
    check(`${pg.path} exactly one <h1>`, m.h1s === 1, `h1=${m.h1s}`);
    check(`${pg.path} all <img> have alt`, m.imgsNoAlt === 0, `${m.imgsNoAlt} missing`);
    check(`${pg.path} lang="fa" dir="rtl"`, html.includes('lang="fa"') && html.includes('dir="rtl"'));
  }

  // ── noindex / gated pages
  for (const pg of NOINDEX_PAGES) {
    const res = await fetch(`${BASE}${pg.path}`, { redirect: 'manual' });
    if (pg.redirect) {
      check(`${pg.path} gated (redirects)`, res.status >= 300 && res.status < 400, String(res.status));
    } else {
      const html = await res.text();
      const m = getMeta(html);
      check(`${pg.path} title «${pg.mustTitle}»`, m.title.includes(pg.mustTitle));
      check(`${pg.path} noindex`, m.robots.includes('noindex'));
    }
  }

  // ── sitemap.xml
  const sm = await fetch(`${BASE}/sitemap.xml`);
  check('sitemap.xml 200', sm.status === 200);
  const smText = await sm.text();
  const BASEURL = 'http://localhost:3100';
  check('sitemap lists public pages', ['/','/request','/privacy','/terms','/data-retention'].every(p => smText.includes(`<loc>${BASEURL}${p}</loc>`)));
  check('sitemap excludes app pages', !smText.includes('/dashboard') && !smText.includes('/admin'));

  // ── robots.txt
  const rb = await fetch(`${BASE}/robots.txt`);
  check('robots.txt 200', rb.status === 200);
  const rbText = await rb.text();
  check('robots.txt allows /', rbText.includes('Allow: /'));
  check('robots.txt disallows /api/', rbText.includes('Disallow: /api/'));
  check('robots.txt references sitemap', rbText.includes('sitemap.xml'));

  // ── r/[slug] (QR target) is noindex
  const r = await fetch(`${BASE}/r/room-room-a`);
  const rHtml = await r.text();
  check('/r/[slug] 200', r.status === 200);
  check('/r/[slug] noindex', rHtml.includes('noindex'));

  // ── manifest + favicon reachable
  check('manifest.webmanifest 200', (await fetch(`${BASE}/manifest.webmanifest`)).status === 200);
  check('apple-touch-icon 200', (await fetch(`${BASE}/icons/apple-touch-icon.png`)).status === 200);

  // ── rendering sanity in a real browser (meta present after hydration too)
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle', timeout: 45000 });
  const domTitle = await page.title();
  check('browser title after hydration', domTitle.includes('درخواست جلسه'), domTitle);
  // request redesign: side panel + benefits render on desktop
  const panel = await page.evaluate(() => document.body.innerText.includes('جلسه‌تان را درخواست کنید'));
  check('/request side panel renders', panel);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('/request no x-overflow', ov <= 1, `+${ov}px`);
  // mobile: single column, brand visible
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const mobileBrand = await page.evaluate(() => document.body.innerText.includes('مهرسا'));
  check('/request mobile brand visible', mobileBrand);
  const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('/request mobile no x-overflow', ov2 <= 1, `+${ov2}px`);
  await browser.close();

  console.log(`\n${pass}/${pass + fail} passed`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log('  ✗', f));
    process.exit(1);
  }
})().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
