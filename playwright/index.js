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
    headless: false, //  ====================== true for headless mode ======================
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process' ,
      '--use-gl=desktop', // Helps with WebGL fingerprinting
      '--window-size=1920,1080',
      '--no-sandbox',
      //'--headless=new'      ====================== Uncomment for headless mode ======================
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
  });

  // --- SELECTIVE STEALTH ---
  // We only hide the 'webdriver' property for Cloudflare.
  // This prevents JumpCloud from getting confused by fingerprint changes.
  if (app.toLowerCase() === "cloudflare") {
    console.log("[CLOUDFLARE] Applying lightweight stealth...");
    await context.addInitScript(() => {
      // Deletes the 'webdriver' property so Cloudflare doesn't see it
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
  }

  const page = await context.newPage();

  try {
    console.log(`[${app.toUpperCase()}] Starting fresh review... `);
    
    // Standard flow: Login -> Load -> Capture
    await adapter.login(page);
    
    // We use 'load' to be safe for Slack/JumpCloud
    await page.waitForLoadState('load', { timeout: 60000 });

    /* ---------- EVIDENCE CAPTURE ---------- */
    if (app === "oci") {
      for (const g of groups) {
        await captureOciGroup(page, adapter, g, app);
      }
    } else {
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
  console.log(`[OCI] Waiting 2s before screenshot...`);
  await page.waitForTimeout(2000);

  const file = path.join(dir, "users.png");
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[OCI] Saved ${group.name}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}