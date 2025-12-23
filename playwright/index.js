import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { autoScroll } from "./utils.js";

export async function captureUserListEvidence(app, adapter) {
  const userDataDir = adapter.userDataDir;

  const context = await chromium.launchPersistentContext(
    userDataDir,
    {
      headless: adapter.headless ?? true,
      viewport: { width: 1280, height: 900 }
    }
  );

  const page = await context.newPage();

  await adapter.login(page);
  await adapter.gotoUsers(page);

  await page.waitForSelector(adapter.usersTableSelector, {
    timeout: 60_000
  });

  await autoScroll(page);

  const outDir = `evidence/${app}`;
  fs.mkdirSync(outDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `users-${ts}.png`);

  await page.screenshot({ path: outPath, fullPage: true });

  console.log(`[${app}] Evidence saved → ${outPath}`);

  await context.close();
}
