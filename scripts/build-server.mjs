import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "cloudfunctions", "api");
await mkdir(output, { recursive: true });

await build({
  entryPoints: [path.join(root, "server", "api", "src", "index.ts")],
  outfile: path.join(output, "index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  minify: false,
  external: ["wx-server-sdk"],
  logLevel: "info",
});

await mkdir(path.join(root, "cloudfunctions", "scheduleJobs"), { recursive: true });
await build({
  entryPoints: [path.join(root, "server", "jobs", "src", "index.ts")],
  outfile: path.join(root, "cloudfunctions", "scheduleJobs", "index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  minify: false,
  external: ["wx-server-sdk"],
  logLevel: "info",
});

await mkdir(path.join(root, ".build"), { recursive: true });
await build({
  entryPoints: [path.join(root, "server", "api", "src", "testing.ts")],
  outfile: path.join(root, ".build", "server-testing.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  logLevel: "silent",
});
