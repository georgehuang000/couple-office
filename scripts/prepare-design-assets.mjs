import sharp from "sharp";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

// Full-resolution editable masters live outside miniprogramRoot. Runtime files
// are generated at ~2x their 390px CSS viewport slots, never from full screens.
const root = process.cwd();
const sources = path.join(root, "design-assets", "generated");
const output = path.join(root, "miniprogram", "assets", "journal");
await mkdir(output, { recursive: true });
const assets = [
  ["task-hero-clean.png", "task-hero.jpg", 780],
  ["approval-hero-clean.png", "approval-hero.jpg", 780],
  ["us-hero-clean.png", "us-hero.jpg", 780],
  ["calendar-stage-clean.png", "calendar-stage.jpg", 780],
  ["task-card-clean.png", "task-card.jpg", 744],
  ["approval-card-clean.png", "approval-card.jpg", 744],
  ["paper-texture.png", "paper-texture.jpg", 512],
];
const manifest = [];
for (const [source, target, width] of assets) {
  const input = path.join(sources, source);
  const destination = path.join(output, target);
  try { await access(input); }
  catch { await access(destination); console.log(`Using prepared ${target}`); continue; }
  const info = await sharp(input).resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(destination);
  manifest.push({ source: `generated/${source}`, runtime: `../miniprogram/assets/journal/${target}`, width: info.width, height: info.height, bytes: info.size, method: "image_gen reference edit; opaque JPEG at runtime" });
  console.log(`${target}: ${info.width}×${info.height}, ${(info.size / 1024).toFixed(1)} KiB`);
}
await writeFile(path.join(root, "design-assets", "manifest.json"), JSON.stringify({ version: 1, assets: manifest }, null, 2) + "\n");
const texture = (await readFile(path.join(output, "paper-texture.jpg"))).toString("base64");
await mkdir(path.join(root, "miniprogram", "styles"), { recursive: true });
await writeFile(path.join(root, "miniprogram", "styles", "journal-surfaces.wxss"), `/* WXSS requires embedded or remote URLs for CSS background images. */\n.journal-page,.texture-panel,.tab-shell,.tab-safe-area{background-image:url("data:image/jpeg;base64,${texture}");background-size:512rpx 512rpx;}\n`);

// Official Tabler icons replace contaminated/blurred screenshot crops.
// Upstream paths are retained verbatim, only stroke/color attributes change.
const iconRoot = path.join(root, "design-assets", "tabler");
await mkdir(iconRoot, { recursive: true });
const icons = ["home", "square-rounded-check", "calendar-week", "users", "clock", "map-pin", "chevron-left", "chevron-right", "chevron-down", "plus", "check", "calendar-check", "star", "photo", "message-dots", "heart"];
for (const name of icons) {
  const source = path.join(iconRoot, `${name}.svg`);
  let svg;
  try { svg = await readFile(source, "utf8"); }
  catch {
    const url = `https://raw.githubusercontent.com/tabler/tabler-icons/v3.34.1/icons/outline/${name}.svg`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Icon ${name}: HTTP ${response.status}`);
    svg = await response.text();
    await writeFile(source, svg);
  }
  for (const [state, color] of [["ink", "#77736d"], ["sage", "#58634b"], ["white", "#fffdf8"], ["peach", "#e6a38c"]]) {
    const colored = svg.replaceAll("currentColor", color).replace('stroke-width="2"', 'stroke-width="1.65"');
    await sharp(Buffer.from(colored)).resize(72, 72).png().toFile(path.join(output, `${name}-${state}.png`));
  }
}
const license = path.join(iconRoot, "LICENSE");
try { await access(license); } catch {
  const response = await fetch("https://raw.githubusercontent.com/tabler/tabler-icons/v3.34.1/LICENSE");
  if (!response.ok) throw new Error("Could not fetch Tabler MIT license");
  await writeFile(license, await response.text());
}
console.log("Prepared reusable journal imagery and official Tabler icons.");
