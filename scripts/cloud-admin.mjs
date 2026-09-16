import { readFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const [, , operation, ...rawArgs] = process.argv;
const getFlag = (name) => { const index = rawArgs.indexOf(name); return index >= 0 ? rawArgs[index + 1] : null; };
const hasFlag = (name) => rawArgs.includes(name);
const envId = getFlag("--env");
const root = process.cwd();
const tcb = process.platform === "win32" ? path.join(root, "node_modules", ".bin", "tcb.cmd") : path.join(root, "node_modules", ".bin", "tcb");

if (!operation || !envId || /^(your-|example|placeholder|dev-xxxx)/i.test(envId)) {
  console.error("Usage: node scripts/cloud-admin.mjs <init|deploy|backup|restore|cleanup> --env <explicit-env-id> [guards]");
  process.exit(2);
}

const production = hasFlag("--production") || /(^|[-_])(prod|production)([-_]|$)/i.test(envId);
function requireConfirmation(flag, label) {
  if (getFlag(flag) !== envId) throw new Error(`${label}: pass ${flag} ${envId}`);
}
if (production && ["init", "deploy", "restore", "cleanup"].includes(operation)) requireConfirmation("--confirm-production", "Production environment confirmation required");

function run(args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(tcb, args, { cwd: root, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 || allowFailure ? resolve(code) : reject(new Error(`tcb ${args.join(" ")} failed with code ${code}`)));
  });
}

async function init() {
  const manifest = JSON.parse(await readFile(path.join(root, "cloudbase", "indexes.json"), "utf8"));
  for (const [collection, indexes] of Object.entries(manifest.collections)) {
    const createCollection = [{ TableName: collection, CommandType: "COMMAND", Command: JSON.stringify({ create: collection }) }];
    await run(["db", "nosql", "execute", "--command", JSON.stringify(createCollection), "-e", envId], { allowFailure: true });
    if (indexes.length) {
      const createIndexes = [{ TableName: collection, CommandType: "COMMAND", Command: JSON.stringify({ createIndexes: collection, indexes }) }];
      await run(["db", "nosql", "execute", "--command", JSON.stringify(createIndexes), "-e", envId]);
    }
  }
  const policy = await readFile(path.join(root, "security", "admin-only.rego"), "utf8");
  await run(["policy", "set", policy, "-e", envId]);
  console.log(`Initialized collections, indexes, and deny-by-default policy in ${envId}.`);
}

async function deploy() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await new Promise((resolve, reject) => {
    const child = spawn(npm, ["run", "build:server"], { cwd: root, stdio: "inherit", shell: false });
    child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`server build failed: ${code}`)));
  });
  await run(["fn", "deploy", "--all", "--force", "-e", envId]);
}

async function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = path.join(root, "backups", envId, stamp);
  await mkdir(output, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(root, "cloudbase", "indexes.json"), "utf8"));
  for (const collection of Object.keys(manifest.collections)) await run(["db", "nosql", "dump", collection, "--file-type", "json", "--output-dir", output, "-e", envId]);
  console.log(`Backup downloaded to ${output}`);
}

async function restore() {
  requireConfirmation("--confirm-restore", "Restore confirmation required");
  const time = getFlag("--time");
  const tables = getFlag("--tables");
  if (!time || !tables) throw new Error("Restore requires --time \"YYYY-MM-DD HH:mm:ss\" and --tables '<JSON>'. Run tcb db nosql restore-tables first to preview.");
  await run(["db", "nosql", "backup", "restore", "--time", time, "--tables", tables, "-e", envId]);
}

async function cleanup() {
  requireConfirmation("--confirm-cleanup", "Cleanup confirmation required");
  const manifest = JSON.parse(await readFile(path.join(root, "cloudbase", "indexes.json"), "utf8"));
  for (const collection of Object.keys(manifest.collections)) {
    const deletion = [{ TableName: collection, CommandType: "DELETE", Command: JSON.stringify({ delete: collection, deletes: [{ q: {}, limit: 0 }] }) }];
    await run(["db", "nosql", "execute", "--command", JSON.stringify(deletion), "-e", envId]);
  }
  console.log(`All documents removed from declared collections in ${envId}; collections and indexes were retained.`);
}

const operations = { init, deploy, backup, restore, cleanup };
if (!operations[operation]) throw new Error(`Unknown operation: ${operation}`);
await operations[operation]();
