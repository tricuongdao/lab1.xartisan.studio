import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Chromium/Edge launcher for the render + verification scripts.
// The binary is resolved per platform; set CHROME_PATH (or EDGE) to override.
const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.EDGE,
  "/usr/bin/microsoft-edge",
  "/usr/bin/microsoft-edge-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/snap/bin/brave",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

async function resolveBrowser() {
  for (const bin of CANDIDATES) {
    try {
      await fs.access(bin);
      return bin;
    } catch {}
  }
  throw new Error(`No Chromium/Edge binary found. Set CHROME_PATH. Tried:\n  ${CANDIDATES.join("\n  ")}`);
}

async function waitForEndpoint(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

export async function launch({ port = 9333, headless = true, profile } = {}) {
  const binary = await resolveBrowser();
  const dir = profile ?? (await fs.mkdtemp(path.join(os.tmpdir(), "chromium-prof-")));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,msEdgeIdentityFeatures",
    "--window-size=1440,900",
    "about:blank",
  ];
  if (headless) args.unshift("--headless=new");

  // Some sandboxed hosts abort Chromium's own sandbox; retry once with it off.
  const attempts = [args, [...args, "--no-sandbox", "--disable-dev-shm-usage"]];
  let proc;
  for (const [i, attempt] of attempts.entries()) {
    proc = spawn(binary, attempt, { stdio: "ignore" });
    const version = await waitForEndpoint(port);
    if (version) {
      return { proc, port, dir, version, binary, close: () => { try { proc.kill(); } catch {} } };
    }
    try { proc.kill(); } catch {}
    if (i === 0) await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Browser did not expose CDP on port ${port} (tried ${binary}, with and without --no-sandbox)`);
}

export async function newTarget(port, url = "about:blank") {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  return r.json();
}

export class Session {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = []; }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.addEventListener("open", res, { once: true });
      this.ws.addEventListener("error", rej, { once: true });
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
    return this;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(fn) { this.listeners.push(fn); }
  close() { try { this.ws.close(); } catch {} }
}
