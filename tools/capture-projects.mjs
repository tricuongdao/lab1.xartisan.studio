// Captures the project-grid hover previews from each project's live site.
//
//   node tools/capture-projects.mjs            # every project in tools/content.mjs
//   node tools/capture-projects.mjs volta      # one project
//
// Writes build-src/generated/projects/<slug>/previews/<slug>-NN-<kind>.webp,
// which `npm run build` copies into site/. Needs the CDP launcher in tools/cdp.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import { launch, newTarget, Session } from "./cdp.mjs";
import { projects } from "./content.mjs";

const SIZES = [
  { kind: "square", width: 1000, height: 800 },
  { kind: "portrait", width: 700, height: 985 },
];
const only = process.argv[2];
const port = 9790;

const list = projects.filter((p) => !only || p.slug === only);
if (!list.length) throw new Error(`no project matches "${only}"`);

const b = await launch({ port });
const t = await newTarget(port, "about:blank");
const s = await new Session(t.webSocketDebuggerUrl).open();
await s.send("Page.enable");
await s.send("Runtime.enable");

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;
for (const project of list) {
  const outDir = path.join("build-src", "generated", "projects", project.slug, "previews");
  await fs.mkdir(outDir, { recursive: true });

  for (const size of SIZES) {
    await s.send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: size.width < 600,
    });

    for (const page of project.pages) {
      n += 1;
      const url = new URL(page.path ?? page, project.href).href;
      await s.send("Page.navigate", { url });
      await settle(project.settle);
      if (page.scroll) {
        await s.send("Runtime.evaluate", { expression: `window.scrollTo(0, ${page.scroll})` });
        await settle(1500);
      }
      const shot = await s.send("Page.captureScreenshot", { format: "webp", quality: 85 });
      const name = `${project.slug}-${String(n).padStart(2, "0")}-${size.kind}.webp`;
      await fs.writeFile(path.join(outDir, name), Buffer.from(shot.data, "base64"));
      console.log("wrote", path.join(outDir, name));
    }
  }
}

s.close();
b.close();
process.exit(0);
