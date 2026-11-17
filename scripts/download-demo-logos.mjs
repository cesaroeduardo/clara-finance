/**
 * Baixa logos do Logo.dev para fallback local do demo (sem chave no preview).
 * Uso: node --env-file=.env.local scripts/download-demo-logos.mjs
 */
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
if (!token) {
  console.error("Defina NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY (ex.: --env-file=.env.local).");
  process.exit(1);
}

/** @type {Array<{ dir: string, file: string, domain: string, theme?: string }>} */
const logos = [
  // Instituições do demo
  { dir: "institutions", file: "nubank.png", domain: "nubank.com.br" },
  { dir: "institutions", file: "itau.png", domain: "itau.com.br", theme: "light" },
  { dir: "institutions", file: "btg.png", domain: "btgpactual.com" },
  { dir: "institutions", file: "xp.png", domain: "xpi.com.br" },
  { dir: "institutions", file: "clear.png", domain: "clear.com.br" },
  // Mercado / bolsa
  { dir: "market", file: "apple.png", domain: "apple.com", theme: "light" },
  { dir: "market", file: "nvidia.png", domain: "nvidia.com" },
  { dir: "market", file: "bb.png", domain: "bb.com.br", theme: "light" },
  { dir: "market", file: "cpfl.png", domain: "cpfl.com.br" },
  { dir: "market", file: "b3.png", domain: "b3.com.br" },
  { dir: "market", file: "spacex.png", domain: "spacex.com" },
  // Estabelecimentos do demo
  { dir: "merchants", file: "smartfit.png", domain: "smartfit.com.br" },
  { dir: "merchants", file: "amil.png", domain: "amil.com.br" },
  { dir: "merchants", file: "carrefour.png", domain: "carrefour.com.br" },
  { dir: "merchants", file: "starbucks.png", domain: "starbucks.com" },
  { dir: "merchants", file: "uber.png", domain: "uber.com" },
  { dir: "merchants", file: "netflix.png", domain: "netflix.com" },
  { dir: "merchants", file: "rge.png", domain: "rge-rs.com.br" },
  { dir: "merchants", file: "unifique.png", domain: "unifique.com.br" },
  { dir: "merchants", file: "spotify.png", domain: "spotify.com" },
  { dir: "merchants", file: "apple.png", domain: "apple.com", theme: "light" },
  { dir: "merchants", file: "magalu.png", domain: "magazineluiza.com.br" },
  { dir: "merchants", file: "outback.png", domain: "outback.com" },
  { dir: "merchants", file: "drogaraia.png", domain: "drogaraia.com.br" },
  { dir: "merchants", file: "ifood.png", domain: "ifood.com.br" },
  { dir: "merchants", file: "mercadolivre.png", domain: "mercadolivre.com.br" },
  { dir: "merchants", file: "cursor.png", domain: "cursor.com" },
  { dir: "merchants", file: "99.png", domain: "99app.com" },
  { dir: "merchants", file: "youtube.png", domain: "youtube.com" },
  { dir: "merchants", file: "amazon.png", domain: "amazon.com.br" },
  { dir: "merchants", file: "steam.png", domain: "steampowered.com" },
  { dir: "merchants", file: "shell.png", domain: "shell.com.br" },
  { dir: "merchants", file: "latam.png", domain: "latamairlines.com" },
  { dir: "merchants", file: "nubank.png", domain: "nubank.com.br" },
  { dir: "merchants", file: "adobe.png", domain: "adobe.com" },
  { dir: "merchants", file: "alura.png", domain: "alura.com.br" },
  { dir: "merchants", file: "petz.png", domain: "petz.com.br" },
];

const root = path.resolve("public");
const manifest = {};

async function download(url, filePath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`${res.status} ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(filePath));
  return res.status;
}

for (const logo of logos) {
  const dir = path.join(root, logo.dir);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, logo.file);
  const params = new URLSearchParams({
    token,
    size: "128",
    format: "png",
    fallback: "404",
    retina: "true",
  });
  if (logo.theme) params.set("theme", logo.theme);
  const url = `https://img.logo.dev/${logo.domain}?${params}`;
  try {
    await download(url, filePath);
    const key = `${logo.dir}/${logo.file}`;
    manifest[key] = { domain: logo.domain, theme: logo.theme || null };
    console.log(`ok ${key} <- ${logo.domain}`);
  } catch (error) {
    console.warn(`skip ${logo.dir}/${logo.file}: ${error.message}`);
  }
}

await writeFile(
  path.join(root, "logo-fallbacks.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`done ${Object.keys(manifest).length} logos`);
