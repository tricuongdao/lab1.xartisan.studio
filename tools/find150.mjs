import fs from "node:fs";
const js = fs.readFileSync("site/assets/setupCrossPageTransitions-xt2.js", "utf8");
let i = -1;
while ((i = js.indexOf("150+", i + 1)) !== -1) {
  console.log("@", i, JSON.stringify(js.slice(Math.max(0, i - 120), i + 40)));
}
