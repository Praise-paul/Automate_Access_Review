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
    await page.fill(accountInput, "neospaceai");
    await page.click('#cloudAccountButton');

    // --- Phase 2: Credentials ---
    console.log("[OCI] Entering credentials...");
    const userField = '#idcs-signin-basic-signin-form-username';
    await page.waitForSelector(userField);
    await page.fill(userField, process.env.OCI_EMAIL);

    // Using attribute selector for special characters in ID
    const passField = 'input[id="idcs-signin-basic-signin-form-password|input"]';
    await page.waitForSelector(passField);
    await page.fill(passField, process.env.OCI_PASSWORD);

    await page.click('#idcs-signin-basic-signin-form-submit button');

    // --- Phase 3: MFA Passcode ---
    console.log("[OCI] Waiting for MFA passcode field...");
    const mfaInput = 'input[id="idcs-mfa-mfa-auth-passcode-input|input"]';
    await page.waitForSelector(mfaInput, { timeout: 30000 });

    const token = generateSync({ secret: process.env.OCI_MFA_SECRET });
    console.log("[OCI] Entering MFA Token:", token);
    await page.fill(mfaInput, token);

    const verifyBtn = '#idcs-mfa-mfa-auth-totp-submit-button button';
    await page.waitForSelector(verifyBtn);
    await page.click(verifyBtn);

    // --- Phase 4: Handle Post-MFA Redirects ---
    // Instead of forcing a URL immediately, we wait for OCI to finish its internal redirect
    console.log("[OCI] Waiting for OCI to stabilize after login...");
    await page.waitForTimeout(5000); 

    const identityHome = 
      `https://cloud.oracle.com/identity/domains/` +
      `${process.env.OCI_DOMAIN_OCID}` +
      `/users?region=${process.env.OCI_REGION}`;

    console.log("[OCI] Forcing Identity console load...");
    // Switched to domcontentloaded to prevent the ERR_ABORTED timeout
    await page.goto(identityHome, { waitUntil: "domcontentloaded" });
  },

  async loggedInCheck(page) {
    console.log("[OCI] Verifying Identity console readiness");
    await page.waitForURL(
      url => url.href.includes("/identity/domains/"),
      { timeout: 180_000 }
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