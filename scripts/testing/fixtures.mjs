/** Deterministic synthetic core corpus; no desktop-vault content is redistributed. */
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import lz from "lz-string";
import { fileHash, sha256, walkFiles } from "./contracts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const FIXTURE_GENERATOR = "synthetic-core-v1";
export function scene(count = 2) {
  return { type: "excalidraw", version: 2, source: "https://excalidraw.com", elements: Array.from({ length: count }, (_, i) => ({
    id: `fixture-${i}`, type: "rectangle", x: i * 120, y: (i % 3) * 80, width: 100, height: 60,
    angle: i === 1 ? Math.PI / 6 : 0, strokeColor: "#1e1e1e", backgroundColor: i ? "#ff0000" : "transparent",
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: i ? 50 : 100,
    groupIds: [], frameId: null, roundness: null, seed: i + 1, version: 1, versionNonce: 0, isDeleted: false,
    boundElements: null, updated: 1, link: i ? "[[Links/\u00c1rv\u00edzt\u0171r\u0151 \u6d4b\u8bd5|Alias]]" : null, locked: false,
    customData: { fixture: true, retainedUnknown: { value: i } }, index: `a${i}`,
  })), appState: { viewBackgroundColor: "#ffffff", gridSize: null }, files: {} };
}
export function drawingMarkdown(value, compressed = false) {
  const json = JSON.stringify(value, null, 2);
  return `---\nexcalidraw-plugin: parsed\ntags: [automation-fixture]\n---\n\nUser Markdown retained.\n\n# Excalidraw Data\n\n## Text Elements\n\n%%\n## Drawing\n\`\`\`${compressed ? "compressed-json" : "json"}\n${compressed ? lz.compressToBase64(json) : json}\n\`\`\`\n%%\n`;
}
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
export function transparentPNG() {
  const header = Buffer.alloc(13); header.writeUInt32BE(4, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 128, 0, 0, 255, 255, 0, 255, 0, 255,
    0, 0, 255, 0, 255, 0, 0, 255, 128, 255, 0, 0, 255, 0, 0, 0, 0]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}
export function smallPDF() {
  const stream = "0 0 1 rg 20 20 100 60 re f\nBT /F1 14 Tf 20 100 Td (Synthetic fixture) Tj ET\n";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 160] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n", offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export function coreFixtures() {
  const value = scene();
  return {
    ".obsidian/app.json": "{}\n", ".obsidian/appearance.json": '{"theme":"moonstone"}\n',
    ".obsidian/community-plugins.json": "[]\n",
    "Drawings/Uncompressed.excalidraw.md": drawingMarkdown(value),
    "Drawings/Compressed.excalidraw.md": drawingMarkdown(value, true),
    "Drawings/Legacy.excalidraw": JSON.stringify(value, null, 2) + "\n",
    "Invalid/Truncated.excalidraw.md": drawingMarkdown(value).slice(0, -140).trimEnd(),
    "Invalid/Corrupt.excalidraw.md": "---\nexcalidraw-plugin: parsed\n---\n\n%%\n## Drawing\n```compressed-json\ninvalid-compression!\n```\n%%\n",
    "Links/\u00c1rv\u00edzt\u0171r\u0151 \u6d4b\u8bd5.md": "---\naliases: [Alias]\n---\n\n# Unicode fixture\n\n[[../Drawings/Uncompressed.excalidraw|Drawing alias]]\n",
    "Notes/Embeds.md": "# Owned test note\n\n![[Drawings/Uncompressed.excalidraw.md|320]]\n\n![[Assets/Transparency.png|160]]\n\n$E=mc^2$\n\n```mermaid\nflowchart LR\n A[Start] --> B[Done]\n```\n",
    "Assets/Transparency.png": transparentPNG(),
    "Assets/Layers.svg": '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 120 80"><g id="red" opacity="0.5"><rect x="10" y="10" width="70" height="50" fill="red"/><circle cx="75" cy="40" r="25" fill="blue"/></g><path d="M0 0L120 80" stroke="black"/></svg>\n',
    "Assets/Small.pdf": smallPDF(),
    "Sources/Equations.json": JSON.stringify(["E=mc^2", "\\frac{a}{b}+\\sqrt{x}", "\\sum_{n=1}^{10}n^2", "\\newcommand{\\owned}{x}\\owned"], null, 2) + "\n",
    "Sources/Diagrams.json": JSON.stringify(["flowchart LR\n A --> B", "sequenceDiagram\n A->>B: Hello", "classDiagram\n Animal <|-- Duck", "not valid mermaid"], null, 2) + "\n",
  };
}
export function generateCore({ check = false, destination = join(root, "tests/vault") } = {}) {
  const fixtures = coreFixtures();
  const entries = Object.entries(fixtures).map(([path, content]) => ({ id: path, path, sha256: sha256(content), bytes: Buffer.byteLength(content),
    provenance: "Generated synthetic fixture; no imported vault or third-party artwork", license: "CC0-1.0", generator: FIXTURE_GENERATOR }));
  for (const [path, content] of Object.entries(fixtures)) {
    const file = join(destination, path);
    if (check) {
      if (!existsSync(file) || fileHash(file) !== sha256(content)) throw Error(`Fixture drift: ${path}`);
    } else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); }
  }
  if (walkFiles(destination).join("\n") !== entries.map(e => e.path).sort().join("\n")) throw Error("Unexpected file in immutable seed");
  const manifest = { schemaVersion: 2, generator: FIXTURE_GENERATOR, fixtures: entries, stress: { generator: "scene", defaultCount: 2000, maxCount: 10000, checkedIn: false } };
  const manifestPath = join(root, "tests/fixtures/manifest.json"), text = JSON.stringify(manifest, null, 2) + "\n";
  if (check) { if (readFileSync(manifestPath, "utf8") !== text) throw Error("Fixture manifest drift"); }
  else { mkdirSync(dirname(manifestPath), { recursive: true }); writeFileSync(manifestPath, text); }
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = generateCore({ check: process.argv.includes("--check") });
  process.stdout.write(`${manifest.fixtures.length} synthetic core fixtures verified\n`);
}
