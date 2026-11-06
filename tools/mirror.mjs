import fs from "node:fs/promises";
import path from "node:path";

const BASE = "https://lab1.ximitech.vn";
const OUT = "site";
const known = new Set();

async function head(url) {
  const r = await fetch(url, { method: "HEAD" });
  return r.status;
}

async function dl(p) {
  if (known.has(p)) return;
  known.add(p);
  const url = BASE + (p.startsWith("/") ? p : "/" + p);
  const res = await fetch(url);
  if (!res.ok) { console.log("FAIL", res.status, p); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(OUT, decodeURIComponent(p.replace(/^\//, "")));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  const ct = res.headers.get("content-type") ?? "";
  console.log("ok", p, buf.length);
  if (/text\/css/.test(ct)) {
    const css = buf.toString("utf8");
    for (const m of css.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)) {
      const v = m[1].trim();
      if (/^(data:|https?:|#)/.test(v)) continue;
      const abs = v.startsWith("/") ? v : "/" + path.posix.normalize(path.posix.join(path.posix.dirname(p), v));
      await dl(abs);
    }
  }
}

const html = (await fs.readFile("build-src/index.original.html", "utf8"));
const jsFiles = ["assets/home-xt2.js", "assets/setupCrossPageTransitions-xt2.js", "assets/setupHeaderVisibility-D-FHk4jp.js", "assets/ximitech-sound.js", "assets/chunk-Deb1DmFP.js"];
const list = new Set();

// html refs
for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const v = m[1];
  if (/^(https?:|data:|mailto:|tel:|#)/.test(v)) continue;
  list.add("/" + v.replace(/^\.?\//, ""));
}
// know js/css from requests
for (const u of JSON.parse(await fs.readFile("build-src/requests.json", "utf8"))) {
  const p = new URL(u).pathname;
  if (p.startsWith("/assets/") || p.startsWith("/brand/") || p.startsWith("/home/")) list.add(p);
}
// dynamic chunks + literals from js
const jsTexts = {};
for (const f of jsFiles) jsTexts[f] = await fs.readFile("build-src/" + f.replaceAll("/", "_"), "utf8").catch(() => "");
for (const f of ["build-src/assets_home-xt2.js", "build-src/assets_setupCrossPageTransitions-xt2.js"]) {
  const t = await fs.readFile(f, "utf8");
  for (const m of t.matchAll(/["'`]([^"'`\s<>]{2,160}\.(?:glb|gltf|webp|png|jpg|jpeg|svg|mp3|wav|ogg|json|woff2?|ttf|otf|mp4|webm|hdr|exr|ktx2))["'`]/gi)) {
    let p = m[1];
    if (p.includes("${")) continue;
    if (!p.startsWith("/")) continue;
    list.add(p);
  }
  for (const m of t.matchAll(/from"\.\/([^"]+)"/g)) list.add("/assets/" + m[1]);
  for (const m of t.matchAll(/`\.\/([^`]+\.js)`/g)) list.add("/assets/" + m[1]);
  for (const m of t.matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:js|css))/g)) list.add("/assets/" + m[1]);
}
// extra known project previews (en + vi variants may exist)
for (const p of [...list]) {
  const m = p.match(/^\/(projects\/[a-z0-9-]+)\/previews\//);
  if (m) for (let i = 1; i <= 6; i++) {
    const base = m[1].split("/")[1];
    list.add(`/${m[1]}/previews/${base}-0${i}-${i === 3 || i === 5 || i === 6 ? "portrait" : "square"}.webp`);
  }
}
// common brand extras
for (const p of ["/brand/favicon.ico", "/brand/apple-touch-icon.png"]) list.add(p);

await fs.mkdir(OUT, { recursive: true });
const all = [...list].sort();
console.log("total", all.length);
for (const p of all) { try { await dl(p); } catch (e) { console.log("ERR", p, e.message); } }
