import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BASE =
  "M9 0h4v1h-4zM8 1h6v1h-6zM7 2h8v1h-8zM7 3h8v1h-8zM8 4h6v1h-6zM6 5h10v1h-10zM5 6h12v1h-12zM4 7h14v1h-14zM3 8h7v1h-7zM12 8h7v1h-7zM3 9h6v1h-6zM13 9h6v1h-6zM2 10h6v1h-6zM14 10h6v1h-6zM2 11h5v1h-5zM15 11h5v1h-5zM1 12h5v1h-5zM16 12h5v1h-5zM1 13h4v1h-4zM17 13h4v1h-4zM0 14h4v1h-4zM18 14h4v1h-4zM0 15h3v1h-3zM4 15h6v1h-6zM12 15h6v1h-6zM19 15h3v1h-3zM0 16h2v1h-2zM3 16h1v1h-1zM10 16h2v1h-2zM18 16h1v1h-1zM20 16h2v1h-2zM0 17h2v1h-2zM3 17h1v1h-1zM10 17h2v1h-2zM18 17h1v1h-1zM20 17h2v1h-2zM0 18h2v1h-2zM3 18h1v1h-1zM10 18h2v1h-2zM18 18h1v1h-1zM20 18h2v1h-2zM0 19h2v1h-2zM3 19h1v1h-1zM10 19h2v1h-2zM18 19h1v1h-1zM20 19h2v1h-2zM1 20h1v1h-1zM4 20h6v1h-6zM12 20h6v1h-6zM20 20h1v1h-1zM1 21h1v1h-1zM20 21h1v1h-1zM2 22h1v1h-1zM10 22h2v1h-2zM19 22h1v1h-1zM3 23h1v1h-1zM18 23h1v1h-1zM4 24h2v1h-2zM16 24h2v1h-2zM6 25h10v1h-10z";

const EYES_OPEN =
  "M6 17h2v1h-2zM14 17h2v1h-2zM5 18h1v1h-1zM8 18h1v1h-1zM13 18h1v1h-1zM16 18h1v1h-1z";

const EYES_SHUT = "M5 18h4v1h-4zM13 18h4v1h-4z";

const SIZE = 1080;
const MARK_W = 22;
const MARK_H = 26;
const SCALE = 28;
const markPxW = MARK_W * SCALE;
const markPxH = MARK_H * SCALE;
const ox = Math.floor((SIZE - markPxW) / 2);
const oy = Math.floor((SIZE - markPxH) / 2);

function svgFor(eyes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#000000"/>
  <g transform="translate(${ox} ${oy}) scale(${SCALE})" fill="#ffffff" shape-rendering="crispEdges">
    <path d="${BASE}"/>
    <path d="${eyes}"/>
  </g>
</svg>`;
}

const outDir = path.join(ROOT, "exports", "clara-mark-blink-frames");
fs.mkdirSync(outDir, { recursive: true });

const openPath = path.join(outDir, "open.png");
const shutPath = path.join(outDir, "shut.png");

await sharp(Buffer.from(svgFor(EYES_OPEN))).png().toFile(openPath);
await sharp(Buffer.from(svgFor(EYES_SHUT))).png().toFile(shutPath);

// Match CSS clara-eyes-* 10s step-end cycle
const segments = [
  { file: "open.png", dur: 8.6 },
  { file: "shut.png", dur: 0.3 },
  { file: "open.png", dur: 0.3 },
  { file: "shut.png", dur: 0.3 },
  { file: "open.png", dur: 0.5 },
];

const listPath = path.join(outDir, "concat.txt");
const lines = [];
for (let c = 0; c < 2; c++) {
  for (const seg of segments) {
    const abs = path.resolve(outDir, seg.file).replaceAll("\\", "/");
    lines.push(`file '${abs}'`);
    lines.push(`duration ${seg.dur}`);
  }
}
lines.push(`file '${path.resolve(outDir, "open.png").replaceAll("\\", "/")}'`);
fs.writeFileSync(listPath, lines.join("\n"));

const outMp4 = path.join(ROOT, "exports", "clara-mark-blink.mp4");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-fps_mode",
    "cfr",
    "-r",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-movflags",
    "+faststart",
    outMp4,
  ],
  { stdio: "inherit" },
);

const st = fs.statSync(outMp4);
console.log(`Wrote ${outMp4} (${Math.round(st.size / 1024)} KB)`);
