import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";
const port = 9795;
const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();
await s.send("Page.enable"); await s.send("Runtime.enable");
await s.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s.send("Page.navigate", { url: "http://127.0.0.1:5177/" });
await new Promise(r => setTimeout(r, 8000));
let best = null;
for (let y = 11000; y <= 15500; y += 120) {
  await s.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})` });
  await new Promise(r => setTimeout(r, 220));
  const info = await s.send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('.trajectory-sentences__sentence')].filter(e => e.textContent.trim().startsWith('50+')).map(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), cy: Math.round(r.top + r.height/2), w: Math.round(r.width) }; })[0] ?? null)`,
    returnByValue: true,
  });
  const item = JSON.parse(info.result.value);
  if (item && item.w > 40) {
    const score = Math.abs(item.cy - 450);
    if (!best || score < best.score) best = { y, score, ...item };
  }
}
console.log(JSON.stringify(best));
if (best) {
  await s.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${best.y})` });
  await new Promise(r => setTimeout(r, 1600));
  const d = await s.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile("build-src/fifty.png", Buffer.from(d.data, "base64"));
  console.log("shot at", best.y);
}
s.close(); b.close(); process.exit(0);
