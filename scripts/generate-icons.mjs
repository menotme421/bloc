import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve("public/icons");
await mkdir(outDir, { recursive: true });

const BLOCKS = `
  <rect x="136" y="128" width="240" height="80" rx="20" fill="#fafafa"/>
  <rect x="136" y="216" width="176" height="80" rx="20" fill="#e4e4e7"/>
  <rect x="136" y="304" width="208" height="80" rx="20" fill="#a1a1aa"/>`;

const anyIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0a0a0a"/>
  ${BLOCKS}
</svg>`;

const maskableIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <g transform="translate(87.04 87.04) scale(0.66)">
    ${BLOCKS}
  </g>
</svg>`;

const appleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <g transform="translate(71.68 71.68) scale(0.72)">
    ${BLOCKS}
  </g>
</svg>`;

const jobs = [
  ["icon-192.png", anyIcon(192)],
  ["icon-512.png", anyIcon(512)],
  ["icon-maskable-192.png", maskableIcon],
  ["icon-maskable-512.png", maskableIcon],
  ["apple-touch-icon.png", appleIcon],
];

for (const [file, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, file));
  console.log("generated", file);
}

// Keep the vector favicon in sync with the PNGs from the same source.
// Mirrors components/bloc-logo.tsx.
await writeFile(path.join(outDir, "bloc-icon.svg"), anyIcon(512));
console.log("generated", "bloc-icon.svg");
