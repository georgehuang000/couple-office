import AdmZip from "adm-zip";
import sharp from "sharp";
import path from "node:path";
import { access, mkdir } from "node:fs/promises";

const root = process.cwd();
const zipPath = path.join(root, "两人事务所_UI资产包_v2.zip");
const output = path.join(root, "miniprogram", "assets");
await mkdir(output, { recursive: true });

const assets = [
  ["水彩纸艺爱心小屋图标.png", "brand-mark.png", 150],
  ["米色植物拼贴相框横幅.png", "home-hero.png", 760],
  ["水彩花枝撕纸便签贴纸.png", "flower-note.png", 300],
  ["透明背景的米白纸纹导航栏.png", "tab-paper.png", 760],
  ["复古花卉撕纸拼贴横幅.png", "calendar-hero.png", 760],
  ["复古撕边纸张日历模板.png", "calendar-paper.png", 760],
  ["复古手工纸便签与黄铜环.png", "approval-note.png", 520],
  ["透明背景纸艺风横向卡片_ui_模板.png", "approval-card.png", 760],
  ["米色撕纸拼贴与绿叶相框模板.png", "us-hero.png", 760],
  ["奶油色手作花卉便签卡.png", "wish-card.png", 520],
  ["复古植物爱心胶带贴纸集.png", "love-stickers.png", 280],
];

let zip;
try {
  await access(zipPath);
  zip = new AdmZip(zipPath);
} catch {
  let allPresent = true;
  for (const [, filename] of assets) {
    try { await access(path.join(output, filename)); } catch { allPresent = false; }
  }
  if (allPresent) {
    console.log("Source asset archive is absent; using prepared runtime assets.");
    process.exit(0);
  }
  throw new Error("Missing UI asset archive and prepared assets.");
}

const entries = zip.getEntries();
for (const [sourceName, targetName, width] of assets) {
  const entry = entries.find((candidate) => candidate.entryName.endsWith(`/${sourceName}`));
  if (!entry) throw new Error(`Asset not found in archive: ${sourceName}`);
  const image = sharp(entry.getData()).resize({ width, withoutEnlargement: true });
  await image.png({ compressionLevel: 9, palette: true, quality: 82, colours: 192 }).toFile(path.join(output, targetName));
  console.log(`${sourceName} -> ${targetName}`);
}
