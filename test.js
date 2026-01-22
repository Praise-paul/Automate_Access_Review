import "dotenv/config";
import { generateSync } from 'otplib';

export const ociAdapter = {
  name: "OCI",
  userDataDir: "./.oci-profile",
  headless: false,
selector: '.oj-table-element, [role="grid"], table',
  dashboardUrl: `https://cloud.oracle.com/identity/domains/${process.env.OCI_DOMAIN_OCID}/users?region=${process.env.OCI_REGION}`,

  async login(page) {
   console.log("[OCI] Starting automated login...");
    await page.goto(`https://cloud.oracle.com/?region=${process.env.OCI_REGION}`);

    // --- Phase 1: Cloud Account Name ---
    const accountInput = '#cloudAccountName';
    await page.waitForSelector(accountInput);
    await page.fill(accountInput, "neospaceai");
    await page.click('#cloudAccountButton');
    // --- Phase 2: Credentials ---
    console.log("[OCI] Entering credentials...");
    const userField = '#idcs-signin-basic-signin-form-username';
    await page.waitForSelector(userField, { timeout: 30000 });
    await page.fill(userField, process.env.OCI_EMAIL);

    const passField = 'input[id="idcs-signin-basic-signin-form-password|input"]';
    await page.waitForSelector(passField);
    await page.fill(passField, process.env.OCI_PASSWORD);
    await page.click('#idcs-signin-basic-signin-form-submit button');

    // --- Phase 3: MFA ---
    console.log("[OCI] Waiting for MFA passcode...");
    const mfaInput = 'input[id="idcs-mfa-mfa-auth-passcode-input|input"]';
    await page.waitForSelector(mfaInput, { timeout: 30000 });

    const token = generateSync({ secret: process.env.OCI_MFA_SECRET });
    console.log("[OCI] Entering MFA Token:", token);
    await page.fill(mfaInput, token);
    await page.click('#idcs-mfa-mfa-auth-totp-submit-button button');

    // --- Phase 4: Settle ---
    console.log("[OCI] MFA submitted, waiting for redirect...");
    await page.waitForTimeout(10000); 
  },

  async loggedInCheck(page) {
    console.log("[OCI] Verifying dashboard content...");
    // Wait for the URL and the presence of the table scroller
    await page.waitForURL(url => url.href.includes("/identity/domains/"), { timeout: 60000 });
    await page.waitForSelector('.oj-table-element', { timeout: 30000 });
  },

  async gotoGroupUsers(page, groupId, groupName) {
    const groupUrl = `https://cloud.oracle.com/identity/domains/${process.env.OCI_DOMAIN_OCID}/groups/${groupId}/group-users?region=${process.env.OCI_REGION}`;

    console.log(`[OCI] Navigating to group: ${groupName}`);
    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });
    
    // If OCI is being slow, it might bounce back to login here. 
    // This check catches it:
    if (page.url().includes("login")) {
        throw new Error("Session lost during group navigation. Refresh required.");
    }

    await page.waitForTimeout(8000); 
  }
};




index.js

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