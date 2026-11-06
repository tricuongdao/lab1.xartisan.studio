import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";
const port = 9793;
const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();
await s.send("Page.enable"); await s.send("Runtime.enable");
await s.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s.send("Page.navigate", { url: "http://127.0.0.1:5177/" });
await new Promise(r => setTimeout(r, 8000));

const max = (await s.send("Runtime.evaluate", { expression: "document.documentElement.scrollHeight - innerHeight", returnByValue: true })).result.value;
const targets = ["2 years", "50+"];
const best = {};
for (let y = 2000; y <= 12000; y += 150) {
  await s.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})` });
  await new Promise(r => setTimeout(r, 220));
  const info = await s.send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('.trajectory-sentences__sentence')].map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().replace(/\\s+/g,' ').slice(0,16), top: Math.round(r.top), bot: Math.round(r.bottom), cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2), w: Math.round(r.width), h: Math.round(r.height) }; }))`,
    returnByValue: true,
  });
  for (const item of JSON.parse(info.result.value)) {
    for (const want of targets) {
      if (item.t.startsWith(want) && item.w > 40 && item.h > 20) {
        const score = Math.abs(item.cy - 450) + Math.abs(item.cx - 720) * 0.5;
        if (!best[want] || score < best[want].score) best[want] = { y, score, ...item };
      }
    }
  }
}
console.log(JSON.stringify(best, null, 1));
for (const [want, info] of Object.entries(best)) {
  await s.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${info.y})` });
  await new Promise(r => setTimeout(r, 1500));
  const d = await s.send("Page.captureScreenshot", { format: "png" });
  const name = want === "50+" ? "fifty" : "two-years";
  await fs.writeFile(`build-src/${name}.png`, Buffer.from(d.data, "base64"));
  console.log("shot", name, info.y);
}
s.close(); b.close(); process.exit(0);
