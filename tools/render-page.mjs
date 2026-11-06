import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";

export async function shootPage({ url, width, height, out, waitMs = 1200 }) {
  const port = 9500 + Math.floor(Math.random() * 300);
  const b = await launch({ port });
  try {
    const t = await newTarget(port, "about:blank");
    const s = await new Session(t.webSocketDebuggerUrl).open();
    await s.send("Page.enable");
    await s.send("Runtime.enable");
    await s.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await s.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, waitMs));
    const shot = await s.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(out, Buffer.from(shot.data, "base64"));
    s.close();
    return out;
  } finally {
    b.close();
  }
}

if (process.argv[1].endsWith("render-page.mjs")) {
  const [url, w, h, out] = process.argv.slice(2);
  console.log("wrote", await shootPage({ url, width: +w, height: +h, out }));
  process.exit(0);
}
