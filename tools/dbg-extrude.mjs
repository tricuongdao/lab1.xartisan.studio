import { launch, newTarget, Session } from "./cdp.mjs";
const port = 9777;
const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();
const logs = [];
s.on(m => {
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + ": " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description ?? JSON.stringify(m.params.exceptionDetails)).slice(0, 400));
  if (m.method === "Network.loadingFailed") logs.push("NETFAIL " + m.params.errorText + " " + (m.params.type ?? ""));
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400) logs.push("HTTP " + m.params.response.status + " " + m.params.response.url);
});
await s.send("Page.enable"); await s.send("Network.enable"); await s.send("Runtime.enable");
await s.send("Page.navigate", { url: "http://127.0.0.1:5188/_dev/extrude.html" });
await new Promise(r => setTimeout(r, 5000));
const st = await s.send("Runtime.evaluate", { expression: "JSON.stringify({ready: window.__ready, build: typeof window.__build})", returnByValue: true });
console.log(st.result.value);
console.log(logs.slice(0, 10).join("\n"));
s.close(); b.close(); process.exit(0);
