import ci from "miniprogram-ci";
import path from "node:path";
import { access, readFile } from "node:fs/promises";

const root = process.cwd();
const appid = "wx3efc253d50e263b6";
const privateKeyPath = process.env.COUPLE_OA_UPLOAD_KEY || path.join(root, `private.${appid}.key`);
await access(privateKeyPath);
const environmentConfig = await readFile(path.join(root, "miniprogram", "config", "env.ts"), "utf8");
if (environmentConfig.includes("YOUR_CLOUDBASE_ENV_ID")) throw new Error("Refusing to upload: configure the linked CloudBase development environment first.");

const project = new ci.Project({
  appid,
  type: "miniProgram",
  projectPath: root,
  privateKeyPath,
  ignores: ["node_modules/**/*", "server/**/*", "tests/**/*", "docs/**/*", "*.zip", "private.*.key"],
});

await ci.upload({
  project,
  version: "1.0.0-beta.1",
  desc: "两人事务所 V1 体验版：双人协作、待办、审批、日历、纪念日与愿望",
  robot: 1,
  setting: { useProjectConfig: true },
  onProgressUpdate: (progress) => console.log(progress),
});
