import fs from "node:fs";
let p = "tools/dev/extrude.html";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  'import { GLTFExporter } from "https://unpkg.com/three@0.169.0/examples/jsm/exporters/GLTFExporter.js";',
  'import { GLTFExporter } from "https://unpkg.com/three@0.169.0/examples/jsm/exporters/GLTFExporter.js";\n      import { toCreasedNormals } from "https://unpkg.com/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js";',
);
s = s.replace(
  '        geom.scale(s, s, s);\n        geom.center();\n        geom.computeVertexNormals();',
  '        geom.scale(s, s, s);\n        geom.center();\n        const smooth = toCreasedNormals(geom, THREE.MathUtils.degToRad(35));',
);
s = s.replace('scene.add(new THREE.Mesh(geom, material));', 'scene.add(new THREE.Mesh(smooth, material));');
s = s.replace('vertices: geom.getAttribute("position").count,', 'vertices: smooth.getAttribute("position").count,');
fs.writeFileSync(p, s);
console.log(s.includes("toCreasedNormals") ? "patched" : "NOT patched");
