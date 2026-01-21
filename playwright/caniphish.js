import 'dotenv/config';
import { generateSync } from 'otplib';

export const caniphishAdapter = {
  userDataDir: "playwright/profiles/caniphish",
  headless: false,
  name: "CANIPHISH",
  dashboardUrl: "https://caniphish.com/platform/settings?queryType=ManageTenant",
  
  // Unique selector for CanIPhish dashboard content
  selector: "table, .table-responsive, #tenant-settings-container",

  async isLoggedIn(page) {
    return page.url().includes("/platform/") && !page.url().includes("/Auth/Login");
  },

  async login(page) {
    console.log("[CANIPHISH] Opening login page...");
    await page.goto("https://caniphish.com/Auth/Login", { waitUntil: "domcontentloaded" });

    // 1. Click the "Sign in with Single Sign-On" button
    console.log("[CANIPHISH] Opening SSO Modal...");
    await page.waitForSelector('#ssoButton', { state: 'visible' });
    await page.click('#ssoButton');

    // 2. Identification Modal - Use the email field you identified
    console.log("[CANIPHISH] Entering email for identification...");
    await page.waitForSelector('#ssoSigninEmail', { state: 'visible' });
    await page.fill('#ssoSigninEmail', process.env.JUMPCLOUD_EMAIL);
    
    // 3. Click the "Sign in" button inside the modal
    await page.click('#ssoSigninButton');

    // --- JumpCloud Workflow (Parallel to Slack but separate variables/logs) ---
    console.log("[CANIPHISH] Redirected to JumpCloud. Entering credentials...");

    // 4. JumpCloud Email
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });
    await page.fill('input[name="email"]', process.env.JUMPCLOUD_EMAIL);
    await page.click('button[data-automation="loginButton"]');

    // 5. JumpCloud Password
    await page.waitForSelector('input[name="password"]');
    await page.fill('input[name="password"]', process.env.JUMPCLOUD_PASSWORD);
    await page.click('button[data-automation="loginButton"]');

    // 6. JumpCloud MFA Input
    console.log("[CANIPHISH] Handling JumpCloud MFA...");
    try {
      await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 20000 });

      const mfaToken = generateSync({ secret: process.env.JUMPCLOUD_MFA_SECRET });
      const inputs = page.locator('.TotpInput__loginInput');

      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).pressSequentially(mfaToken[i], { delay: 150 });
      }

      console.log("[CANIPHISH] MFA submitted, waiting for redirect...");

      // 7. Wait for redirect back to the platform
      await page.waitForURL(
        url => url.href.startsWith("https://caniphish.com/platform"),
        { timeout: 60000 }
      );

      console.log("[CANIPHISH] Login successful! ✅");

    } catch (error) {
      console.error("[CANIPHISH] SSO login sequence failed:", error.message);
      throw error;
    }
  },

  async gotoUsers(page) {
    console.log("[CANIPHISH] Navigating to Tenant settings...");
    await page.goto(this.dashboardUrl, { waitUntil: "domcontentloaded" });
    // Allow for SPA data fetching
    await page.waitForTimeout(8000);
  },

  async loggedInCheck(page) {
    await page.waitForFunction(() => 
      window.location.href.includes("/platform/") && 
      !document.body.innerText.includes("Login"), 
      { timeout: 30000 }
    );
  }
};