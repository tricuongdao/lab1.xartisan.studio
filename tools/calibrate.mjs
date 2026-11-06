import { renderTexture } from "./render-lib.mjs";
import { execFileSync } from "node:child_process";

const PY = "C:/Users/cuong/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe";
const size = Number(process.argv[2] ?? 420);
let margin = Number(process.argv[3] ?? 0);

for (let pass = 0; pass < 3; pass++) {
  await renderTexture({
    width: 4096, height: 1024, port: 5177,
    family: "CabinetGrotesk-Regular", weight: "400", size,
    lineHeight: 454, paddingTop: 0, marginTop: margin,
    lines: ["xartisan", "studio"], color: "rgb(255,245,237)",
    out: "build-src/tex-xartisan.png",
  });
  const out = execFileSync(PY, ["tools/measure-baseline.py"], { encoding: "utf8" }).trim().split("\n");
  const rows = out.map((l) => l.trim().split(/\s+/).map(Number));
  const line2 = rows.at(-1);
  console.log(`size=${size} pass=${pass} margin=${margin} baseline2=${line2[0]} x=${line2[1]}..${line2[2]}`);
  if (Math.abs(line2[0] - 905) <= 1) break;
  margin += 905 - line2[0];
}
