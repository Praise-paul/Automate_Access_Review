import { chromium } from "playwright";
import fs from "fs";

const WORKSPACE_ID = process.env.SLACK_WORKSPACE_ID;

export async function screenshotSlackMembersEvidence() {
  const context = await chromium.launchPersistentContext(
    "./.auth/slack",
    { headless: true }
  );

  const page = await context.newPage();

  await page.goto(
    `https://app.slack.com/manage/${WORKSPACE_ID}/people`,
    { waitUntil: "domcontentloaded" }
  );

  // Allow Slack UI to fully render
  await page.waitForTimeout(15000);

  fs.mkdirSync("evidence/slack", { recursive: true });

  const ts = new Date().toISOString().split("T")[0];
  const path = `evidence/slack/slack-members-evidence-${ts}.png`;

  await page.screenshot({
    path,
    fullPage: true
  });

  await context.close();
  return path;
}
