import fs from "node:fs";
const buf = fs.readFileSync("site/home/hero/logo-xartisan.glb");
console.log("size", buf.length, "magic", buf.toString("ascii", 0, 4), "version", buf.readUInt32LE(4));
let off = 12;
const chunks = [];
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.toString("ascii", off + 4, off + 8);
  chunks.push({ type, len, start: off + 8 });
  off += 8 + len;
}
console.log(chunks.map(c => c.type + ":" + c.len).join(" "));
const json = JSON.parse(buf.toString("utf8", chunks[0].start, chunks[0].start + chunks[0].len));
console.log("asset", JSON.stringify(json.asset));
console.log("scenes", JSON.stringify(json.scenes));
console.log("nodes", JSON.stringify(json.nodes).slice(0, 800));
console.log("meshes", JSON.stringify(json.meshes).slice(0, 500));
console.log("materials", JSON.stringify(json.materials).slice(0, 600));
console.log("accessors", JSON.stringify(json.accessors).slice(0, 1200));
console.log("images/textures", (json.images ?? []).length, (json.textures ?? []).length);
