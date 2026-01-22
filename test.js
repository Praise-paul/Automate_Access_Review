///////////////////////////////////////////////
//oci.js
///////////////////////////////////////////////
import "dotenv/config";
import { generateSync } from 'otplib';

export const ociAdapter = {
  userDataDir: "./.oci-profile",
  headless: false,
  // OCI table rows often use this class
  selector: '.oj-table-body-row, [role="row"], table',

  async login(page) {
    console.log("[OCI] Starting automated login...");
    await page.goto(`https://cloud.oracle.com/?region=${process.env.OCI_REGION}`, { waitUntil: "domcontentloaded" });

    // --- Phase 1: Cloud Account Name ---
    const accountInput = '#cloudAccountName';
    await page.waitForSelector(accountInput);
    await page.click(accountInput);
    await page.focus(accountInput);
    await page.type(accountInput, "neospaceai", { delay: 100 });
    await page.click('#cloudAccountButton', { force: true });

    // --- Phase 2: Credentials ---
    console.log("[OCI] Entering credentials...");
    const userField = '#idcs-signin-basic-signin-form-username';
    await page.waitForSelector(userField);
    await page.type(userField, process.env.OCI_EMAIL);

    // Using attribute selector for special characters in ID
    const passField = 'input[id="idcs-signin-basic-signin-form-password|input"]';
    await page.waitForSelector(passField);
    await page.type(passField, process.env.OCI_PASSWORD);

    await page.click('#idcs-signin-basic-signin-form-submit button');

    // --- Phase 3: MFA Passcode ---
    console.log("[OCI] Waiting for MFA passcode field...");
    const mfaInput = 'input[id="idcs-mfa-mfa-auth-passcode-input|input"]';
    await page.waitForSelector(mfaInput, { timeout: 30000 });

    const token = generateSync({ secret: process.env.OCI_MFA_SECRET });
    console.log("[OCI] Entering MFA Token:", token);
    await page.type(mfaInput, token);

    const verifyBtn = '#idcs-mfa-mfa-auth-totp-submit-button button';
    await page.waitForSelector(verifyBtn);
    await page.click(verifyBtn);

    // --- Phase 4: Handle Post-MFA Redirects ---
    console.log("[OCI] Waiting for session stabilization...");
    // Wait for the Oracle dashboard to appear before forcing navigation
    await page.waitForLoadState('load'); 
    await page.waitForTimeout(5000); 

    const identityHome = 
      `https://cloud.oracle.com/identity/domains/` +
      `${process.env.OCI_DOMAIN_OCID}` +
      `/users?region=${process.env.OCI_REGION}`;

    console.log("[OCI] Navigating to Identity console...");
    await page.goto(identityHome, { waitUntil: "domcontentloaded" });
  },

  async loggedInCheck(page) {
    console.log("[OCI] Verifying Identity console readiness");
    await page.waitForURL(
      url => url.href.includes("/identity/domains/"),
      { timeout: 3000 }
    );
    console.log("[OCI] Identity console is ready");
  },

  async gotoGroupUsers(page, groupId, groupName) {
    await this.loggedInCheck(page);

    const groupUrl =
      `https://cloud.oracle.com/identity/domains/` +
      `${process.env.OCI_DOMAIN_OCID}` +
      `/groups/${groupId}/group-users` +
      `?region=${process.env.OCI_REGION}`;

    console.log(`[OCI] Navigating to group users: ${groupName}`);
    // Match your manual script's waitUntil
    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });

    console.log(`[OCI] Group page loaded: ${groupName}`);
    // Oracle JET takes time to fetch JSON and render rows
    await page.waitForTimeout(8000); 
  }
};

//crowdstrike.js////////////////////////////////////////////

import 'dotenv/config';
import { generateSync } from 'otplib';

export const crowdstrikeAdapter = {
  name: "CROWDSTRIKE",
  userDataDir: "playwright/profiles/crowdstrike",
  dashboardUrl: "https://falcon.us-2.crowdstrike.com/users-v2", // Use your working URL
  selector: '[data-test-selector="users-table"], table',

  async login(page) {
    console.log("[CROWDSTRIKE] Starting automated login...");
    await page.goto(this.dashboardUrl, { waitUntil: "domcontentloaded" });

    // Step 1: Email
    await page.waitForSelector('[data-test-selector="email"]');
    await page.fill('[data-test-selector="email"]', process.env.CROWDSTRIKE_EMAIL);
    
    // FORCE CLICK here to bypass the "glow" div intercepting the pointer
    await page.click('[data-test-selector="continue"]', { force: true });

    // Step 2: Password
    await page.waitForSelector('[data-test-selector="password"]');
    await page.fill('[data-test-selector="password"]', process.env.CROWDSTRIKE_PASSWORD);
    
    // FORCE CLICK here as well
    await page.click('[data-test-selector="submit"]', { force: true });

    // Step 3: MFA
    console.log("[CROWDSTRIKE] Handling MFA...");
    await page.waitForSelector('[name="verification-code-input-0"]');
    const token = generateSync({ secret: process.env.CROWDSTRIKE_MFA_SECRET });
    
    for (let i = 0; i < 6; i++) {
      // Use fill for MFA digits to be faster and more reliable
      await page.fill(`[name="verification-code-input-${i}"]`, token[i]);
    }
    
    // Click submit and WAIT for the URL to change
    await Promise.all([
      page.click('[data-test-selector="mfa-code-submit"]', { force: true }),
      page.waitForURL(url => !url.href.includes('login'), { timeout: 60000 })
    ]);
    
    console.log("[CROWDSTRIKE] Session established.");
  },

  async loggedInCheck(page, timeout = 15000) {
    await page.waitForURL(
      url => url.href.includes("/hub") || url.href.includes("/users-v2"),
      { timeout }
    );
  },
async gotoUsers(page) {
    console.log("[CROWDSTRIKE] Navigating to Users page");
    // Change "networkidle" to "load" to avoid the timeout you saw in the logs
    await page.goto(this.dashboardUrl, { waitUntil: "load" });
    // Specific wait for the table to ensure SPA rendering is done
    await page.waitForSelector(this.selector, { timeout: 30000 });
  }
};


/////////////////////////////////////////////

////slack.js//////////////////////////////////////////
import 'dotenv/config';
import { generateSync } from 'otplib';

export const slackAdapter = {
  userDataDir: "playwright/profiles/slack",
  headless: false,
  name: "SLACK",
  dashboardUrl: "https://app.slack.com/manage/E08D7Q2A73R/people",
  
  async isLoggedIn(page) {
    try {
        // Look for the "People" header or the Org Admin table
        await page.waitForSelector('[data-qa="org_members_table_header"]', { timeout: 8000 });
        return true;
    } catch (e) {
        return false; // Selector not found, must login
    }
  },

  selector: [
    '[data-qa="org_members_table"]',
    '[data-qa="org_members_table_container"]',
    '[data-qa="org_members_table_body"]',
    '[data-qa="org_members_table_header"]',
    'table',
  ].join(","),

  async login(page) {
    console.log("[SLACK] Opening People admin page");
    await page.goto("https://app.slack.com/manage/E08D7Q2A73R/people");

    // 1. Click "Sign in with JumpCloud"
    const samlBtn = '#enterprise_member_guest_account_signin_link_JumpCloud';
    await page.waitForSelector(samlBtn);
    await page.click(samlBtn);

    // 2. JumpCloud Email
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', process.env.JUMPCLOUD_EMAIL);
    await page.click('button[data-automation="loginButton"]');

    // 3. JumpCloud Password
    await page.waitForSelector('input[name="password"]');
    await page.type('input[name="password"]', process.env.JUMPCLOUD_PASSWORD);
    await page.click('button[data-automation="loginButton"]');

    // 4. MFA Input
    console.log("[SLACK] Handling MFA input...");

    try {
      // Wait for the 6-digit input boxes to appear
      await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 20000 });

      const mfaToken = generateSync({ secret: process.env.JUMPCLOUD_MFA_SECRET });
      const inputs = page.locator('.TotpInput__loginInput');

      console.log("[SLACK] Entering TOTP digits...");
      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).pressSequentially(mfaToken[i], { delay: 150 });
      }

      console.log("[SLACK] MFA submitted, waiting for Slack dashboard...");

      // FIX: Instead of waitForNavigation, we wait for Slack's specific UI to appear.
      // This is much faster and avoids the timeout error.
      await page.waitForFunction(() => {
        return document.body.innerText.includes("People") || 
               document.querySelector('[data-qa="org_members_table_header"]');
      }, { timeout: 30000 });

      console.log("[SLACK] Redirect successful.");

    } catch (error) {
      console.error("[SLACK] Login sequence failed:", error.message);
      throw error;
    }
  },

  async gotoUsers(page) {
    console.log("[SLACK] Waiting for admin UI");
    // Ensure we are on a management URL
    await page.waitForURL(
      url => url.href.includes("/manage/") || url.href.includes("enterprise.slack.com"),
      { timeout: 60000 }
    );

    // Apply Admin Filter
    const filterBtn = '[data-qa="org_members_table_header-filter-button"]';
    await page.waitForSelector(filterBtn, { timeout: 30000 });
    await page.click(filterBtn);
    await page.click('text=Org Admins & Owners');

    // Wait for the table to refresh with the filtered data
    await page.waitForFunction(() => document.body.innerText.includes("Org Admins"));
    console.log("[SLACK] Admin filter applied");
  },

  async loggedInCheck(page) {
    await page.waitForFunction(() => document.body.innerText.includes("People"), { timeout: 30000 });
  }
};


/////////////////////////////////////////////////index.js//////////////////////////////////////////
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