import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import "dotenv/config";

/**
 * Entry point — never breaks the access review.
 */
export async function captureUserListEvidence(app, adapter, groups = []) {
  try {
    await _capture(app, adapter, groups);
  } catch (e) {
    console.warn(`[${app.toUpperCase()}] UI evidence failed`);
    console.warn(e.message);
  }
}

async function _capture(app, adapter, groups) {
  if (app === "oci") {
  console.log(`[OCI] Playwright received ${groups.length} groups`);
}

  const context = await chromium.launchPersistentContext(
    adapter.userDataDir,
    {
      headless: adapter.headless ?? false,
      viewport: { width: 1400, height: 1000 },
      ignoreHTTPSErrors: true
    }
  );

  const page = context.pages()[0] || await context.newPage();

  try {
    /* ---------- LOGIN ---------- */
    await adapter.login(page);

    if (typeof adapter.loggedInCheck === "function") {
  try {
    // Fast path: already logged in
    await adapter.loggedInCheck(page);
  } catch {
    console.log(
      `[${app.toUpperCase()}] Waiting for manual login/MFA (polling for readiness)...`
    );

    const start = Date.now();
    const MAX_WAIT = 5 * 60_000; // 5 minutes
    const POLL_INTERVAL = 10_000; // 10 seconds

    while (Date.now() - start < MAX_WAIT) {
      try {
        await adapter.loggedInCheck(page);
        console.log(`[${app.toUpperCase()}] Login detected, continuing`);
        break;
      } catch {
        await page.waitForTimeout(POLL_INTERVAL);
      }
    }
  }
}


    /* ---------- OCI: GROUP-WISE ---------- */
    /* ---------- OCI: GROUP-WISE ---------- */
if (app === "oci") {
  for (const g of groups) {
    try {
      await captureOciGroup(page, adapter, g, app);
    } catch (err) {
      console.warn(`[OCI] Failed for group ${g.name}`);
      console.warn(err.message);
    }
  }

}


    /* ---------- SLACK / CROWDSTRIKE: GENERIC ---------- */
    await captureGenericTable(app, page, adapter);

  } finally {
    await context.close();
  }
}

/* =================================================================
   GENERIC TABLE CAPTURE (SLACK / CROWDSTRIKE)
================================================================= */

async function captureGenericTable(app, page, adapter) {
  const dir = path.join(
  process.cwd(),
  "evidence",
  app
);

  fs.mkdirSync(dir, { recursive: true });

  await adapter.gotoUsers(page);

  await page.waitForSelector(adapter.selector, {
    timeout: 120_000
  });

  // Let UI settle (Slack is async-heavy)
  await page.waitForTimeout(3000);

  const file = path.join(
    dir,
    `users-${timestamp()}.png`
  );

  await page.screenshot({ path: file, fullPage: false });
  console.log(`[${app.toUpperCase()}] Evidence saved → ${file}`);
}

/* =================================================================
   OCI GROUP-WISE CAPTURE
================================================================= */

async function captureOciGroup(page, adapter, group, app) {
  const dir = path.join(
    process.cwd(),
    "evidence",
    app,
    group.name
  );

  fs.mkdirSync(dir, { recursive: true });

  await adapter.gotoGroupUsers(page, group.groupId, group.name);

  console.log(`[OCI] Waiting 10s before screenshot...`);
  await page.waitForTimeout(10_000);

  const file = path.join(dir, "users.png");
  await page.screenshot({ path: file, fullPage: false });

  console.log(`[OCI] Saved ${group.name}`);
}


/* ================================================================= */

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
