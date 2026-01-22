import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import "dotenv/config";

export async function captureUserListEvidence(app, adapter, groups = []) {
  try {
    await _capture(app, adapter, groups);
  } catch (e) {
    console.warn(`[${app.toUpperCase()}] UI evidence failed`);
    console.warn(e.message);
  }
}

async function _capture(app, adapter, groups) {
  const browser = await chromium.launch({
    headless: adapter.headless ?? false,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  try {
    console.log(`[${app.toUpperCase()}] Starting review... `);
    
    // We do NOT call page.goto here anymore.
    // We let the adapter.login(page) handle its own starting URL.
    await adapter.login(page);
    
    // Use 'load' instead of 'networkidle' to prevent Slack/OCI timeouts
    // This waits for the post-login redirect to finish processing
    await page.waitForLoadState('load', { timeout: 60000 });

    /* ---------- EVIDENCE CAPTURE ---------- */
    if (app === "oci") {
      console.log(`[OCI] Starting group-wise capture...`);
      for (const g of groups) {
        await captureOciGroup(page, adapter, g, app);
      }
    } else {
      // For Crowdstrike/Slack, this calls adapter.gotoUsers(page)
      await captureGenericTable(app, page, adapter);
    }

  } finally {
    await browser.close();
    console.log(`[${app.toUpperCase()}] Browser closed. `);
  }
}

async function captureGenericTable(app, page, adapter) {
  const dir = path.join(process.cwd(), "evidence", app);
  fs.mkdirSync(dir, { recursive: true });

  await adapter.gotoUsers(page);
  await page.waitForSelector(adapter.selector, { timeout: 60000 });
  await page.waitForTimeout(3000);

  const file = path.join(dir, `users-${timestamp()}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[${app.toUpperCase()}] Evidence saved → ${file}`);
}

async function captureOciGroup(page, adapter, group, app) {
  const dir = path.join(process.cwd(), "evidence", app, group.name);
  fs.mkdirSync(dir, { recursive: true });

  await adapter.gotoGroupUsers(page, group.groupId, group.name);
  console.log(`[OCI] Waiting 3s before screenshot...`);
  await page.waitForTimeout(3000);

  const file = path.join(dir, "users.png");
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[OCI] Saved ${group.name}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}