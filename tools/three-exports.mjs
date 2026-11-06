import fs from "node:fs";
const t = fs.readFileSync("site/assets/three.module-fBMLdKIM.js", "utf8");
const i = t.lastIndexOf("export{");
console.log("len", t.length, "export at", i);
console.log(t.slice(i, i + 600));
