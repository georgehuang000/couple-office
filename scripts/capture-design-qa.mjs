import automator from "miniprogram-automator";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "design-qa-artifacts");
await mkdir(output, { recursive: true });
const endpoint = process.env.COUPLE_OA_AUTOMATOR_ENDPOINT || "ws://127.0.0.1:9420";
const miniProgram = await automator.connect({ wsEndpoint: endpoint });
const runtimeIssues = [];
miniProgram.on("exception", (issue) => { runtimeIssues.push(issue); console.error("[mini-program exception]", issue); });

try {
  let page = await miniProgram.reLaunch("/pages/onboarding/index");
  await page.waitFor(1200);
  await miniProgram.screenshot({ path: path.join(output, "01-onboarding.png") });
  const demoButton = await page.$(".primary-button");
  if (!demoButton) throw new Error("Demo entry button not found");
  await demoButton.tap();
  await new Promise((resolve) => setTimeout(resolve, 3500));
  page = await miniProgram.currentPage();
  await miniProgram.screenshot({ path: path.join(output, "02-workbench.png") });

  await miniProgram.callWxMethod("setStorageSync", "items_tab", "task");
  page = await miniProgram.switchTab("/pages/items/index");
  await page.waitFor(600);
  await miniProgram.screenshot({ path: path.join(output, "03-items.png") });
  await miniProgram.switchTab("/pages/workbench/index");
  await miniProgram.callWxMethod("setStorageSync", "items_tab", "approval");
  page = await miniProgram.switchTab("/pages/items/index");
  await page.waitFor(600);
  await miniProgram.screenshot({ path: path.join(output, "03b-approvals.png") });

  page = await miniProgram.switchTab("/pages/calendar/index");
  await page.waitFor(600);
  await miniProgram.screenshot({ path: path.join(output, "04-calendar.png") });

  page = await miniProgram.switchTab("/pages/us/index");
  await page.waitFor(600);
  await miniProgram.screenshot({ path: path.join(output, "05-us.png") });
  if (runtimeIssues.length) throw new Error(`Mini program emitted ${runtimeIssues.length} runtime exception(s).`);
  console.log(`Captured 6 screens in ${output}`);
} finally {
  await miniProgram.close();
}
