import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";

export async function renderTexture(spec) {
  const port = 9344 + Math.floor(Math.random() * 200);
  const b = await launch({ port });
  try {
    const t = await newTarget(port, "about:blank");
    const s = await new Session(t.webSocketDebuggerUrl).open();
    await s.send("Page.enable");
    await s.send("Runtime.enable");
    await s.send("Emulation.setDeviceMetricsOverride", { width: spec.width, height: spec.height, deviceScaleFactor: 1, mobile: false });
    await s.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await s.send("Page.navigate", { url: `http://127.0.0.1:${spec.port}/_dev/render.html` });
    await new Promise((r) => setTimeout(r, 900));
    const css = [
      "position:absolute", "left:0", "top:0",
      `width:${spec.width}px`, `height:${spec.height}px`,
      "display:flex", "flex-direction:column", "align-items:center", "justify-content:flex-start",
      `font-family:${spec.family}`, `font-weight:${spec.weight}`, `font-size:${spec.size}px`,
      `line-height:${spec.lineHeight}px`, `letter-spacing:${spec.letterSpacing ?? 0}px`,
      `color:${spec.color ?? "rgb(255,245,237)"}`, "text-align:center", `padding-top:${spec.paddingTop ?? 0}px`, `margin-top:${spec.marginTop ?? 0}px`,
    ].join(";");
    const html = spec.lines.map((l) => `<div>${l}</div>`).join("");
    await s.send("Runtime.evaluate", {
      expression: `document.body.innerHTML="";const d=document.createElement("div");d.style.cssText=${JSON.stringify(css)};d.innerHTML=${JSON.stringify(html)};document.body.append(d);`,
    });
    await new Promise((r) => setTimeout(r, 500));
    const shot = await s.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(spec.out, Buffer.from(shot.data, "base64"));
    s.close();
    return spec.out;
  } finally {
    b.close();
  }
}
