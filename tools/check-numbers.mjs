import fs from "node:fs";
const html = fs.readFileSync("site/index.html", "utf8");
for (const m of html.matchAll(/data-i18n="(home\.trajectorySentence\d|home\.footerProof|home\.description)"[^>]*>([^<]*)</g)) {
  console.log(m[1], "=>", m[2].trim().slice(0, 90));
}
const js = fs.readFileSync("site/assets/setupCrossPageTransitions-xt2.js", "utf8");
for (const probe of ["150+", "8 years"]) console.log(JSON.stringify(probe), "in bundle:", js.includes(probe));
