import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";
const port = 9773;
const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();
await s.send("Page.enable"); await s.send("Runtime.enable");
await s.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await s.send("Page.navigate", { url: "http://127.0.0.1:5188/" });
await new Promise(r => setTimeout(r, 8000));
for (const [name, y] of [["a", 60], ["b", 160], ["c", 320]]) {
  await s.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${y})` });
  await new Promise(r => setTimeout(r, 1800));
  const d = await s.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(`build-src/mark-${name}.png`, Buffer.from(d.data, "base64"));
}
console.log("ok");
s.close(); b.close(); process.exit(0);
