import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");
const svgPath = path.join(publicDir, "icon.svg");

const sizes = [
  { name: "pwa-192x192.png", size: 192 },
  { name: "pwa-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 }
];

const svg = await readFile(svgPath);

for (const icon of sizes) {
  const output = await sharp(svg).resize(icon.size, icon.size).png().toBuffer();
  await writeFile(path.join(publicDir, icon.name), output);
  console.log(`Generated ${icon.name}`);
}
