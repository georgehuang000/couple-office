import sharp from "sharp";
import { access, mkdir, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "design-qa-artifacts");
const searchRoot = process.env.COUPLE_OA_REFERENCE_DIR || path.join(os.tmpdir(), "couple_oa_ui_inspect");

async function findFile(directory, name) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(full, name);
      if (nested) return nested;
    } else if (entry.name === name) return full;
  }
  return null;
}

const pairs = [
  ["待办", "两人事务所_生活待办清单.png", "03-items.png"],
  ["申请", "暖色手账风两人事务所申请页.png", "03b-approvals.png"],
  ["日历", "温柔日常日历界面.png", "04-calendar.png"],
  ["我们", "两人事务所_我们的温柔日常.png", "05-us.png"],
];

const panelWidth = 500;
const panelHeight = 900;
const rowHeight = 980;
const margin = 32;
const canvasWidth = margin * 3 + panelWidth * 2;
const canvasHeight = 90 + rowHeight * pairs.length + margin;
const composites = [];

function labelSvg(text, width, height, size = 28) {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4eee3"/><text x="${width / 2}" y="${height * 0.68}" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="${size}" fill="#50483f">${escaped}</text></svg>`);
}

composites.push({ input: labelSvg("参考图（左） / 小程序实现（右）", canvasWidth, 72, 34), left: 0, top: 0 });
for (let index = 0; index < pairs.length; index += 1) {
  const [title, referenceName, captureName] = pairs[index];
  const reference = await findFile(searchRoot, referenceName);
  if (!reference) throw new Error(`Reference image not found: ${referenceName}`);
  const capture = path.join(outputDir, captureName);
  await access(capture);
  const top = 90 + index * rowHeight;
  composites.push({ input: labelSvg(`${title} · 参考`, panelWidth, 48, 24), left: margin, top });
  composites.push({ input: labelSvg(`${title} · 实现`, panelWidth, 48, 24), left: margin * 2 + panelWidth, top });
  // Reference images include a decorative phone bezel; QA compares only the
  // app-owned screen content against the real simulator capture.
  const normalizedReference = sharp(reference).extract({ left: 80, top: 28, width: 781, height: 1608 });
  composites.push({ input: await normalizedReference.resize({ width: panelWidth, height: panelHeight, fit: "fill" }).png().toBuffer(), left: margin, top: top + 48 });
  composites.push({ input: await sharp(capture).resize({ width: panelWidth, height: panelHeight, fit: "fill" }).png().toBuffer(), left: margin * 2 + panelWidth, top: top + 48 });

  const focusWidth = 781;
  const focusHeight = 1320;
  const focusReference = await sharp(reference)
    .extract({ left: 80, top: 28, width: 781, height: 1608 })
    .extract({ left: 0, top: 0, width: 781, height: focusHeight })
    .png()
    .toBuffer();
  const focusCapture = await sharp(capture)
    .resize({ width: 781, height: 1608, fit: "fill" })
    .extract({ left: 0, top: 0, width: 781, height: focusHeight })
    .png()
    .toBuffer();
  await sharp({ create: { width: focusWidth * 2 + 24, height: focusHeight, channels: 4, background: "#ded6c8" } })
    .composite([
      { input: focusReference, left: 0, top: 0 },
      { input: focusCapture, left: focusWidth + 24, top: 0 },
    ])
    .png()
    .toFile(path.join(outputDir, `focus-${captureName}`));
}

await mkdir(outputDir, { recursive: true });
const target = path.join(outputDir, "comparison.png");
await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#ded6c8" } }).composite(composites).png().toFile(target);
console.log(`Wrote ${target}`);
