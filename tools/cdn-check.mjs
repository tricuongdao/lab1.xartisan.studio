const urls = [
  "https://unpkg.com/three@0.169.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
  "https://unpkg.com/three@0.169.0/examples/jsm/exporters/GLTFExporter.js",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { method: "HEAD" });
    console.log(r.status, u);
  } catch (e) { console.log("ERR", u, e.message); }
}
