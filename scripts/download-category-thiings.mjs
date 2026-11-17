import { chromium } from "playwright-core";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

const OUT = path.resolve("public/illustrations/categories");

/** @type {Record<string, { q: string, prefer: RegExp }>} */
const picks = {
  alimentacao: { q: "cappuccino", prefer: /cappuccino|flat white|^coffee$/i },
  restaurantes: { q: "pizza", prefer: /margherita pizza|^pizza$/i },
  compras: { q: "shopping bag", prefer: /shopping bag/i },
  "contas-da-casa": { q: "house", prefer: /^house$|cottage|home$/i },
  saude: { q: "medicine bottle", prefer: /medicine|pill bottle|first aid/i },
  barbeiro: { q: "hair clipper", prefer: /hair clipper|clipper|barber/i },
  transporte: { q: "car", prefer: /^car$|sedan|hatchback/i },
  assinaturas: { q: "television", prefer: /television|^tv$|smart tv/i },
  software: { q: "laptop", prefer: /laptop|notebook|macbook/i },
  pets: { q: "dog", prefer: /^dog$|puppy|corgi|retriever/i },
  jogos: { q: "game controller", prefer: /controller|gamepad|joystick/i },
  educacao: { q: "graduation cap", prefer: /graduation cap|graduation|diploma/i },
  taxas: { q: "receipt", prefer: /receipt|invoice/i },
  investimentos: { q: "coins", prefer: /coin|stack of coins|gold coins/i },
  transferencias: { q: "wallet", prefer: /wallet|money clip/i },
  "sem-categoria": { q: "question mark", prefer: /question/i },
  outros: { q: "cardboard box", prefer: /box|package|parcel|crate/i },
};

async function collectImages(page) {
  return page.evaluate(() => {
    const out = [];
    for (const img of document.querySelectorAll("img")) {
      const match = img.src.match(/url=(https%3A%2F%2Flftz[^&]+)/);
      if (!match) continue;
      const url = decodeURIComponent(match[1]);
      if (!out.some((item) => item.url === url)) {
        out.push({ alt: img.alt || "", url });
      }
    }
    return out;
  });
}

async function download(url, filePath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(filePath));
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const manifest = {};

for (const [slug, { q, prefer }] of Object.entries(picks)) {
  await page.goto(`https://www.thiings.co/things?q=${encodeURIComponent(q)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2200);
  let items = await collectImages(page);
  if (!items.length) {
    await page.waitForTimeout(2000);
    items = await collectImages(page);
  }
  const chosen =
    items.find((item) => prefer.test(item.alt)) ||
    items.find((item) => item.alt.toLowerCase().includes(q.split(" ")[0])) ||
    items[0];
  if (!chosen) {
    console.warn(`skip ${slug}: no results for "${q}"`);
    continue;
  }
  const file = `${slug}.png`;
  const filePath = path.join(OUT, file);
  await download(chosen.url, filePath);
  manifest[slug] = { alt: chosen.alt, url: chosen.url, file };
  console.log(`${slug} <- ${chosen.alt}`);
}

await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
console.log("done", Object.keys(manifest).length);
