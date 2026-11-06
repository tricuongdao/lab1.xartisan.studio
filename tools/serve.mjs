// Minimal static server for the site — it must be served over HTTP because
// the page uses ES modules and WebGL textures (file:// is blocked by CORS).
//
//   node tools/serve.mjs            → http://localhost:5177
//   PORT=8080 node tools/serve.mjs
//   DEV=1 node tools/serve.mjs      → also serves tools/dev/*.html under /_dev/ (asset generators)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("site");
const DEV = process.env.DEV === "1" || process.argv.includes("--dev");
const DEV_ROOT = path.resolve("tools", "dev");
const PORT = Number(process.env.PORT ?? 5177);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

const inside = (file, root) => path.resolve(file).startsWith(root);

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(ROOT, url);
    let root = ROOT;

    if (DEV && url.startsWith("/_dev/")) {
      file = path.join(DEV_ROOT, url.slice(6));
      root = DEV_ROOT;
    }
    if (url.endsWith("/")) file = path.join(file, "index.html");
    if (!inside(file, root)) {
      res.writeHead(403, { "content-type": "text/plain" }).end("forbidden");
      return;
    }

    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        // unknown extensionless route → let the page handle it
        if (!path.extname(url)) {
          res.writeHead(200, { "content-type": TYPES[".html"] });
          fs.createReadStream(path.join(ROOT, "index.html")).pipe(res);
          return;
        }
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
  })
  .listen(PORT, () => {
    console.log(`Xartisan Studio site → http://localhost:${PORT}`);
    if (DEV) console.log(`dev pages            → http://localhost:${PORT}/_dev/og.html`);
  });

