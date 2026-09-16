import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "miniprogram");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else files.push({ path: path.relative(root, absolute), bytes: (await stat(absolute)).size });
  }
}
await walk(root);
const total = files.reduce((sum, file) => sum + file.bytes, 0);
const limit = 2 * 1024 * 1024;
console.log(`Mini program source package: ${(total / 1024).toFixed(1)} KiB across ${files.length} files`);
if (total > limit) {
  const largest = files.sort((a, b) => b.bytes - a.bytes).slice(0, 10);
  console.error("Main package exceeds 2 MiB. Largest files:", largest);
  process.exitCode = 1;
}
