// Build the extruded Xartisan mark as a GLB (via three.js + GLTFExporter in the browser).
//
//   node tools/serve.mjs --dev
//   node tools/make-glb.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { launch, newTarget, Session } from "./cdp.mjs";

const data = JSON.parse(await fs.readFile("build-src/mark-polygons.json", "utf8"));
const OUT = "build-src/generated/home/hero/logo-xartisan.glb";
const PORT = process.env.SITE_PORT ?? 5177;

const port = 9760 + Math.floor(Math.random() * 200);
const b = await launch({ port });
try {
  const t = await newTarget(port, "about:blank");
  const s = await new Session(t.webSocketDebuggerUrl).open();
  await s.send("Page.enable");
  await s.send("Runtime.enable");
  await s.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/_dev/extrude.html` });

  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const probe = await s.send("Runtime.evaluate", { expression: "!!window.__ready", returnByValue: true });
    ready = probe.result.value === true;
  }
  if (!ready) throw new Error("extrude page did not initialise (CDN blocked?)");

  const res = await s.send("Runtime.evaluate", {
    expression: `window.__build(${JSON.stringify({
      polygons: data.polygons,
      width: data.width,
      targetWidth: 1.49,
      depth: 0.20,
      bevel: 0.032,
    })})`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails).slice(0, 400));

  const { base64, vertices, bbox } = res.result.value;
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, Buffer.from(base64, "base64"));
  console.log("vertices", vertices);
  console.log("bbox min", bbox[0].map((v) => v.toFixed(3)).join(", "), "max", bbox[1].map((v) => v.toFixed(3)).join(", "));
  console.log("wrote", OUT, ((await fs.stat(OUT)).size / 1024).toFixed(1) + " kB");
  s.close();
} finally {
  b.close();
}
process.exit(0);

