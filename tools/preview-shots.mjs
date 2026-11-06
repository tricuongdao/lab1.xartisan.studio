import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";
const URL = "http://127.0.0.1:5177/";
const port = 9781;
const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();
await s.send("Page.enable"); await s.send("Runtime.enable");

async function capture(name, w, h, scrollTo) {
  await s.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await s.send("Page.navigate", { url: URL });
  await new Promise((r) => setTimeout(r, 15000)); // let the WebGL intro finish
  if (scrollTo) {
    // The page smooth-scrolls, so step down to the stop rather than jumping.
    for (let i = 1; i <= 8; i++) {
      await s.send("Runtime.evaluate", {
        expression: `window.scrollTo(0, ${Math.round((scrollTo * i) / 8)})`,
      });
      await new Promise((r) => setTimeout(r, 450));
    }
    await new Promise((r) => setTimeout(r, 1800));
  }
  const d = await s.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(`preview/${name}.png`, Buffer.from(d.data, "base64"));
  console.log("wrote", name);
}

await capture("desktop-hero", 1440, 900, 0);
await capture("desktop-footer", 1440, 900, 9e5);
await capture("mobile-hero", 390, 844, 120);
s.close(); b.close(); process.exit(0);
