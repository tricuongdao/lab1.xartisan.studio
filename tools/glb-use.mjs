import fs from "node:fs";
const t = fs.readFileSync("site/assets/home-xt2.js", "utf8");
const i = t.indexOf("logo-xartisan.glb");
console.log(t.slice(i - 900, i + 900));
