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
  const context = await chromium.launchPersistentContext(adapter.userDataDir, {
    headless: adapter.headless ?? false,
    viewport: { width: 1400, height: 1000 },
    ignoreHTTPSErrors: true
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log(`[${app.toUpperCase()}] Checking session...`);
    
    // Attempt to go to dashboard. OCI often redirects to login automatically.
    // We use a try/catch and small timeout to avoid the ERR_ABORTED crash.
    try {
      await page.goto(adapter.dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      console.log(`[${app.toUpperCase()}] Initial navigation interrupted, checking state...`);
    }

    let isAlreadyIn = false;
    try {
      // Check for active session
      await adapter.loggedInCheck(page, 8000); 
      isAlreadyIn = true;
      console.log(`[${app.toUpperCase()}] Session active! ✅`);
    } catch (e) {
      console.log(`[${app.toUpperCase()}] Session not found. Starting login flow... 🔑`);
    }

    /* ---------- LOGIN ---------- */
    if (!isAlreadyIn) {
      // If we aren't already in, run the adapter login
      await adapter.login(page);
      // Final confirmation
      await adapter.loggedInCheck(page, 60000);
      console.log(`[${app.toUpperCase()}] Login confirmed.`);
    }

    /* ---------- EVIDENCE CAPTURE ---------- */
    if (app === "oci") {
      console.log(`[OCI] Starting group-wise capture for ${groups.length} groups...`);
      for (const g of groups) {
        await captureOciGroup(page, adapter, g, app);
      }
    } else {
      await captureGenericTable(app, page, adapter);
    }

  } finally {
    await context.close();
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