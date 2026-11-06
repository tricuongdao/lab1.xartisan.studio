import fs from "node:fs";
const t = fs.readFileSync("site/assets/home-xt2.js", "utf8");
for (const k of ["Letter_", "getObjectByName", "X_Dark", "Circuit", "Key_Right", "name==="]) {
  const i = t.indexOf(k);
  console.log(k, "->", i);
  if (i > -1) console.log("   ", JSON.stringify(t.slice(Math.max(0, i - 160), i + 160)));
}
