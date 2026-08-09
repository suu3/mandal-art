import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const svgPath = path.join(root, "public", "icon.svg");
const svg = await readFile(svgPath);

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 }
];

for (const { file, size } of targets) {
  const outPath = path.join(root, "public", file);
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(outPath);
  console.log(`generated ${file} (${size}x${size})`);
}

// 마스커블 아이콘: 안전 영역(중앙 80%) 확보를 위해 아트워크를 축소하고 배경색으로 패딩
const maskableSize = 512;
const art = await sharp(svg, { density: 300 })
  .resize(Math.round(maskableSize * 0.78), Math.round(maskableSize * 0.78))
  .png()
  .toBuffer();

await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: "#0a0a0a"
  }
})
  .composite([{ input: art, gravity: "center" }])
  .png()
  .toFile(path.join(root, "public", "icon-maskable-512.png"));
console.log(`generated icon-maskable-512.png (${maskableSize}x${maskableSize})`);
