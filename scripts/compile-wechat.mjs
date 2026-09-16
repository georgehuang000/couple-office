import ci from "miniprogram-ci";
import path from "node:path";
import { access, mkdir } from "node:fs/promises";

const root = process.cwd();
const appid = "wx3efc253d50e263b6";
const privateKeyPath = process.env.COUPLE_OA_UPLOAD_KEY || path.join(root, `private.${appid}.key`);
await access(privateKeyPath);
await mkdir(path.join(root, ".build"), { recursive: true });
const project = new ci.Project({ appid, type: "miniProgram", projectPath: root, privateKeyPath, ignores: ["node_modules/**/*", "server/**/*", "tests/**/*", "docs/**/*", "cloudbase/**/*", "security/**/*", "scripts/**/*", "*.zip", "private.*.key"] });
const result = await ci.getCompiledResult({ project, desc: "couple-oa compile verification", setting: { useProjectConfig: true }, onProgressUpdate: (progress) => console.log(progress) }, path.join(root, ".build", "miniprogram-compiled.zip"));
console.log(`Compiled ${Object.keys(result).length} files successfully.`);
