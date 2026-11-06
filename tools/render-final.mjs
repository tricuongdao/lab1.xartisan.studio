import { renderTexture } from "./render-lib.mjs";
await renderTexture({
  width: 4096, height: 1024, port: 5177,
  family: "CabinetGrotesk-Regular", weight: "400", size: 561,
  lineHeight: 454, paddingTop: 0, marginTop: 53,
  lines: ["xartisan", "studio"], color: "rgb(255,245,237)",
  out: "build-src/tex-xartisan.png",
});
console.log("rendered");
