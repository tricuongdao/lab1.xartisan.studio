// Visual + runtime verification of the built site.
import fs from "node:fs/promises";
import { launch, newTarget, Session } from "./cdp.mjs";

const URL = process.env.URL ?? "http://127.0.0.1:5177/";
const width = Number(process.env.W ?? 1440);
const height = Number(process.env.H ?? 900);
const tag = process.env.TAG ?? "desktop";
const stops = (process.env.STOPS ?? "0,0.12,0.24,0.36,0.5,0.62,0.74,0.86,0.94,1").split(",").map(Number);

const port = 9600 + Math.floor(Math.random() * 200);
const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();

const problems = [];
s.on((m) => {
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400)
    problems.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  if (m.method === "Network.loadingFailed") problems.push(`FAILED ${m.params.errorText}`);
  if (m.method === "Runtime.exceptionThrown")
    problems.push(`EXC ${JSON.stringify(m.params.exceptionDetails).slice(0, 220)}`);
});

await s.send("Page.enable");
await s.send("Network.enable");
await s.send("Runtime.enable");
await s.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
await s.send("Page.navigate", { url: URL });
await new Promise((r) => setTimeout(r, 9000));

await fs.mkdir("build-src/shots", { recursive: true });
for (const [i, p] of stops.entries()) {
  await s.send("Runtime.evaluate", {
    expression: `(()=>{const max=document.documentElement.scrollHeight-innerHeight;window.scrollTo({top:Math.round(max*${p}),behavior:"auto"});return Math.round(max*${p});})()`,
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 1600));
  const shot = await s.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(`build-src/shots/${tag}-${String(i).padStart(2, "0")}-${Math.round(p * 100)}.png`, Buffer.from(shot.data, "base64"));
}

const metrics = await s.send("Runtime.evaluate", {
  expression: `JSON.stringify({scrollHeight: document.documentElement.scrollHeight, innerWidth, innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth + 1, lang: document.documentElement.lang, title: document.title})`,
  returnByValue: true,
});
console.log(tag, metrics.result.value);
console.log("problems:", problems.length ? [...new Set(problems)].join("\n") : "none");
s.close();
b.close();
process.exit(0);
