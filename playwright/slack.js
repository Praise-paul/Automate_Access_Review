import 'dotenv/config';

import { generateSync } from 'otplib';

export const slackAdapter = {
  userDataDir: "playwright/profiles/slack",
  headless: false,

  selector: [
  '[data-qa="org_members_table"]',
  '[data-qa="org_members_table_container"]',
  '[data-qa="org_members_table_body"]',
  '[data-qa="org_members_table_header"]',
  // fallback: any visible table in the manage people view
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
    await page.fill('input[name="email"]', process.env.JUMPCLOUD_EMAIL);
    await page.click('button[data-automation="loginButton"]');

    // 3. JumpCloud Password
    await page.waitForSelector('input[name="password"]');
    await page.fill('input[name="password"]', process.env.JUMPCLOUD_PASSWORD);
    await page.click('button[data-automation="loginButton"]');

    // Step 3: Handle the JumpCloud MFA selection
    console.log("[SLACK] Handling MFA selection...");

    const chooseDifferentWay = 'button[data-test-id="UserLogin__MfaChooser__DisplayOptions"]';
    const totpButtonSelector = 'button[data-test-id="UserLogin__MfaChooser__MfaButtons__totp"]';

    try {
      // 1. Wait specifically for the 'Choose A Different Way' link on the Push screen
      await page.waitForSelector(chooseDifferentWay, { state: 'visible', timeout: 15000 });
      console.log("[SLACK] Found 'Choose A Different Way', clicking...");
      await page.click(chooseDifferentWay);

      // 2. Wait for the selection menu to appear and click the TOTP option
      const totpBtn = page.locator(totpButtonSelector);
      await totpBtn.waitFor({ state: 'visible', timeout: 10000 });
      await totpBtn.click();

      // 3. Wait for the 6-digit input container to be fully visible
      await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 10000 });

      // Step 4: Handle the 6-digit input
      const mfaToken = generateSync({ secret: process.env.JUMPCLOUD_MFA_SECRET });
      const inputs = page.locator('.TotpInput__loginInput');

      console.log("[SLACK] Entering TOTP digits...");
      for (let i = 0; i < 6; i++) {
        // We use pressSequentially with a tiny delay to prevent the race condition
        await inputs.nth(i).pressSequentially(mfaToken[i], { delay: 100 });
      }

      console.log("[SLACK] MFA submitted, waiting for redirect...");
      
      // Optional: Add a small wait here to ensure the login processes before the function ends
      await page.waitForTimeout(5000); 

    } catch (error) {
      console.error("[SLACK] MFA Selection failed or timed out:", error.message);
      // Keeps browser open for debugging if it fails
      await page.waitForTimeout(10000);
      throw error; // Re-throw so the main script knows it failed
    }
  },

  async gotoUsers(page) {
    console.log("[SLACK] Waiting for admin UI");

    await page.waitForURL(
      url =>
        url.href.includes("/manage/") ||
        url.href.includes("enterprise.slack.com"),
      { timeout: 5 * 60_000 }
    );

    await page.waitForTimeout(8000);

    const filterBtn =
      '[data-qa="org_members_table_header-filter-button"]';

    await page.waitForSelector(filterBtn, { timeout: 180_000 });
    await page.click(filterBtn);
    await page.click('text=Org Admins & Owners');

    // Verify filter applied
    await page.waitForFunction(() =>
      document.body.innerText.includes("Org Admins")
    );

    console.log("[SLACK] Admin filter applied");
  },

  async loggedInCheck(page) {
    await page.waitForFunction(() =>
      document.body.innerText.includes("People")
    , { timeout: 30_000 });
  }
};
