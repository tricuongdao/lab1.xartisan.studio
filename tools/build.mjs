// Builds the Xartisan Studio site from the base snapshot and content overrides.
//
// Inputs : build-src/index.original.html, build-src/mirror/** (base snapshot)
// Outputs: site/** (English-only build)
//
// Run: node tools/build.mjs
import fs from "node:fs";
import path from "node:path";
import { brand, overrides } from "./content.mjs";

const report = [];
const warn = [];
const note = (msg) => report.push(msg);

/* ------------------------------------------------------------------ */
/* 0. restore the base snapshot so the build is repeatable             */
/* ------------------------------------------------------------------ */
const pristine = path.join("build-src", "mirror");
if (!fs.existsSync(pristine)) throw new Error("missing build-src/mirror snapshot");
fs.rmSync("site", { recursive: true, force: true });
fs.cpSync(pristine, "site", { recursive: true });
note("restored base snapshot → site/");

// generated brand assets (hero textures, og image, icons) override the base
const generated = path.join("build-src", "generated");
if (fs.existsSync(generated)) {
  fs.cpSync(generated, "site", { recursive: true, force: true });
  note("copied generated brand assets → site/");
}

/* ------------------------------------------------------------------ */
/* 1. i18n dictionary: extract, override, re-serialise                 */
/* ------------------------------------------------------------------ */

function extractObject(text, startIdx) {
  let i = text.indexOf("{", startIdx);
  let depth = 0;
  let inStr = null;
  let out = "";
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === "\\") { out += text[++i]; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "`" || c === '"' || c === "'") { inStr = c; out += c; continue; }
    if (c === "{") depth++;
    if (c === "}") depth--;
    out += c;
    if (depth === 0) return { src: out, end: i + 1 };
  }
  throw new Error("unbalanced object literal");
}

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts.at(-1)] = value;
}

const dictFile = path.join("site", "assets", "setupCrossPageTransitions-xt2.js");
let dictBundle = fs.readFileSync(dictFile, "utf8");

const markerIdx = dictBundle.indexOf("mi={vi:ui,en:li}");
if (markerIdx < 0) throw new Error("i18n marker not found");
const liStart = dictBundle.lastIndexOf("li={", markerIdx);
const { src: liSrc, end: liEnd } = extractObject(dictBundle, liStart);
const en = new Function("return (" + liSrc + ")")();
note(`i18n: extracted ${Object.keys(en).length} sections from the English dictionary`);

for (const [k, v] of Object.entries(overrides)) setPath(en, k, v);
note(`i18n: applied ${Object.keys(overrides).length} English content overrides`);

dictBundle = dictBundle.slice(0, liStart) + "li=" + JSON.stringify(en) + dictBundle.slice(liEnd);

/* ------------------------------------------------------------------ */
/* 2. bundle surgery: English only, no language switch                 */
/* ------------------------------------------------------------------ */

const replacements = (find, repl) => {
  const count = dictBundle.split(find).length - 1;
  if (!count) warn.push(`bundle: "${String(find).slice(0, 60)}" not found`);
  dictBundle = dictBundle.split(find).join(repl);
  if (count) note(`bundle: "${String(find).slice(0, 40)}" ×${count}`);
};

// fallback language + only one supported language
replacements("fi=`vi`,pi=new Set([`vi`,`en`])", "fi=`en`,pi=new Set([`en`])");
// no language switch in the header template
dictBundle = dictBundle.replace(
  /\s*\$\{e\?`\s*<button\s+class="site-header__language-switch"[\s\S]*?<\/button>\s*`\:``\}/,
  "",
);
// no "ximitech.vn" nav entry (the four section links stay)
dictBundle = dictBundle.replace(
  /\s*<a\s+class="site-header__link site-header__link--playground"[\s\S]*?<\/a>/,
  "",
);
// storage namespace + brand strings
replacements("`ximitech.language`", "`xartisan.language`");
replacements("XimiTech", "Xartisan Studio");
replacements("ximitech.vn", brand.domain);
fs.writeFileSync(dictFile, dictBundle);

// 3D hero: logo asset paths live in the home bundle
const homeFile = path.join("site", "assets", "home-xt2.js");
let homeBundle = fs.readFileSync(homeFile, "utf8");
for (const [find, repl] of [
  ["/brand/logo-ximitech.svg", "/brand/logo-xartisan.svg"],
  ["/home/hero/logo-ximitech.glb", "/home/hero/logo-xartisan.glb"],
]) {
  const count = homeBundle.split(find).length - 1;
  if (!count) warn.push(`home bundle: "${find}" not found`);
  homeBundle = homeBundle.split(find).join(repl);
  note(`home bundle: "${find}" ×${count}`);
}
fs.writeFileSync(homeFile, homeBundle);

// stylesheet + sound runtime
const textEdits = [
  ["site/assets/home-xt2.css", "logo-ximitech.svg", "logo-xartisan.svg"],
  ["site/assets/xartisan.css", "/* Chỉnh sửa riêng cho bản XimiTech, nạp sau CSS gốc. */", "/* Xartisan Studio overrides, loaded after the base CSS. */"],
  ["site/assets/xartisan.css", "/* ---------- Intro XimiTech ---------- */", "/* ---------- Intro Xartisan Studio ---------- */"],
  ["site/assets/xartisan.css", '/* ---------- Hero: nhãn "Trang demo năng lực" + nút về ximitech.vn ---------- */', "/* ---------- Hero: studio badge + project CTA ---------- */"],
  ["site/assets/xartisan-sound.js", '"ximitech.sound"', '"xartisan.sound"'],
];
for (const [file, find, repl] of textEdits) {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(find)) { warn.push(`asset: "${find.slice(0, 50)}" not found in ${file}`); continue; }
  fs.writeFileSync(file, src.split(find).join(repl));
  note(`asset: ${path.basename(file)} ← "${find.slice(0, 40)}"`);
}

/* ------------------------------------------------------------------ */
/* 3. index.html                                                       */
/* ------------------------------------------------------------------ */

let html = fs.readFileSync(path.join("build-src", "index.original.html"), "utf8");

// traced brand mark (tools/trace-mark.py) — reused by the intro overlay
const markSvg = fs.readFileSync(path.join("build-src", "generated", "brand", "logo-xartisan.svg"), "utf8");
const mark = {
  viewBox: markSvg.match(/viewBox="([^"]+)"/)[1],
  d: markSvg.match(/\sd="([^"]+)"/)[1],
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const lookup = (key) => {
  const v = key.split(".").reduce((o, k) => (o == null ? o : o[k]), en);
  return typeof v === "string" ? v : null;
};

// 3a. text nodes carrying data-i18n
const missing = new Set();
html = html.replace(
  /(<([a-zA-Z][\w-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2\s*>)/g,
  (m, open, tag, key, inner, close) => {
    const v = lookup(key);
    if (v == null) { missing.add(key); return m; }
    return open + esc(v) + close;
  },
);

// 3b. attributes carrying data-i18n-attr
html = html.replace(
  /<([a-zA-Z][\w-]*)\b([^>]*\bdata-i18n-attr="([^"]+)"[^>]*)>/g,
  (m, tag, attrs, spec) => {
    let out = attrs;
    for (const pair of spec.split(",")) {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (!attr || !key) continue;
      const v = lookup(key);
      if (v == null) { missing.add(key); continue; }
      const re = new RegExp(`\\b${attr}="[^"]*"`);
      if (!re.test(out)) warn.push(`html: ${attr} attribute missing on <${tag}> for ${key}`);
      out = out.replace(re, `${attr}="${esc(v)}"`);
    }
    return `<${tag}${out}>`;
  },
);
if (missing.size) warn.push(`i18n keys with no value: ${[...missing].join(", ")}`);

// 3c. structural + metadata edits
const structural = [
  // English-only bootstrap
  [
    /<!-------- LANGUAGE --------->[\s\S]*?<\/script>/,
    '<!-------- LANGUAGE --------->\n    <script>\n      document.documentElement.lang = "en"\n    </script>',
  ],
  ['<html lang="vi">', '<html lang="en">'],
  // head metadata
  [/<meta name="author" content="[^"]*" \/>/, '<meta name="author" content="Xartisan Studio" />'],
  [
    /<meta\s+property="og:title"\s+content="[^"]*"\s+\/>/,
    '<meta\n      property="og:title"\n      content="Xartisan Studio — Digital Solutions &amp; Web Design"\n    />',
  ],
  ['<link rel="canonical" href="https://lab1.ximitech.vn/" />', '<link rel="canonical" href="https://xartisan.studio/" />'],
  ['<meta property="og:url" content="https://lab1.ximitech.vn/" />', '<meta property="og:url" content="https://xartisan.studio/" />'],
  [
    '<meta property="og:image" content="https://ximitech.vn/OG.png" />',
    '<meta property="og:image" content="https://xartisan.studio/brand/og-image.png" />',
  ],
  ['<link rel="stylesheet" href="assets/ximitech.css">', '<link rel="stylesheet" href="assets/xartisan.css">'],
  ['assets/ximitech-sound.js', 'assets/xartisan-sound.js'],
  ['<!-------- INTRO XIMITECH', '<!-------- INTRO XARTISAN STUDIO'],
  // intro overlay: swap the old X for the traced Xartisan mark (same path as the brand SVG)
  [
    /<svg class="ximi-intro__logo"[\s\S]*?<\/svg>/,
    `<svg class="ximi-intro__logo" viewBox="${mark.viewBox}">
          <path class="ximi-intro__logo-fill" fill-rule="evenodd" d="${mark.d}" />
          <path class="ximi-intro__logo-stroke" fill="none" pathLength="1" d="${mark.d}" />
        </svg>`,
  ],
  // intro overlay word + domain
  [
    /<p class="ximi-intro__word">[\s\S]*?<\/p>/,
    '<p class="ximi-intro__word">' +
      [..."XARTISAN"].map((ch, i) => `<span class="ximi-intro__letter" style="--i:${i}">${ch}</span>`).join("") +
      "</p>",
  ],
  ["<span>ximitech.vn</span>", "<span>xartisan.studio</span>"],
  // hero badge CTA → in-page contact section
  [
    /<a class="lab-badge__cta" href="https:\/\/ximitech\.vn" target="_blank" rel="noreferrer">/,
    '<a class="lab-badge__cta" href="#contact">',
  ],
  // "what's next" link → email instead of Zalo
  [
    /<a\s+class="next-section__playground-link playground-link"\s+href="https:\/\/zalo\.me\/0888889805"\s+target="_blank"\s+rel="noreferrer"\s*>/,
    '<a\n                class="next-section__playground-link playground-link"\n                href="mailto:' +
      brand.email +
      '"\n              >',
  ],
  // legal notice: plain text, no Vietnamese tax registry link
  [
    /<a\s+href="https:\/\/masothue\.com[^"]*"[\s\S]*?data-i18n="home\.legalNotice"[\s\S]*?<\/a\s*>/,
    '<p class="next-footer__meta-link" data-i18n="home.legalNotice">Independent design studio</p>',
  ],
  // contact column: email only
  [
    /<a class="text-link" href="tel:\+84888889805">[\s\S]*?<a class="text-link" href="https:\/\/tiktok\.com\/@doximitech"[^>]*>TikTok<\/a>/,
    '<a class="text-link" href="mailto:' + brand.email + '">' + brand.email + "</a>",
  ],
  // studio column
  [
    /<a class="text-link" href="https:\/\/ximitech\.vn\/gioi-thieu"[^>]*data-i18n="home\.footerCeo">[^<]*<\/a>/,
    '<a class="text-link" href="#manifesto" data-i18n="home.footerCeo">About the studio</a>',
  ],
  [
    /<a class="text-link" href="https:\/\/www\.google\.com\/maps[^>]*data-i18n="home\.footerAddress">[^<]*<\/a>/,
    '<p class="next-footer__meta-link" data-i18n="home.footerAddress">Remote · Worldwide</p>',
  ],
  [/<a class="text-link" href="https:\/\/ximitech\.vn\/ho-so-nang-luc"[^>]*data-i18n="home\.footerProfile">[^<]*<\/a>/, ""],
  [
    /<a class="text-link" href="https:\/\/ximitech\.vn" target="_blank" rel="noreferrer">ximitech\.vn<\/a>/,
    '<a class="text-link" href="https://xartisan.studio" target="_blank" rel="noreferrer">xartisan.studio</a>',
  ],
];

for (const [find, repl] of structural) {
  const before = html;
  html = find instanceof RegExp ? html.replace(find, repl) : html.split(find).join(repl);
  if (html === before) warn.push(`html: edit did not apply → ${String(find).slice(0, 90)}`);
}

fs.writeFileSync(path.join("site", "index.html"), html);
note(`html: wrote site/index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} kB)`);

/* ------------------------------------------------------------------ */
/* 4. report                                                           */
/* ------------------------------------------------------------------ */

console.log(report.map((l) => "  ✓ " + l).join("\n"));
if (warn.length) {
  console.log("\nWARNINGS:");
  console.log(warn.map((l) => "  ! " + l).join("\n"));
  process.exitCode = 1;
} else {
  console.log("\n  no warnings");
}
