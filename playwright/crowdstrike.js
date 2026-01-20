import 'dotenv/config';
import { generateSync } from 'otplib';

export const crowdstrikeAdapter = {
  userDataDir: "playwright/profiles/crowdstrike",
  headless: false,
  selector: '[data-test-selector="users-table"], table',

  async login(page) {
    console.log("[CROWDSTRIKE] Starting automated login...");
    await page.goto("https://falcon.us-2.crowdstrike.com/login/");

    // Step 1: Email
    await page.fill('[data-test-selector="email"]', process.env.CROWDSTRIKE_EMAIL);
    await page.$eval('[data-test-selector="continue"]', el => el.click());

    // Step 2: Password
    await page.waitForSelector('[data-test-selector="password"]');
    await page.fill('[data-test-selector="password"]', process.env.CROWDSTRIKE_PASSWORD);
    await page.$eval('[data-test-selector="submit"]', el => el.click());

    // Step 3: MFA
    await page.waitForSelector('[name="verification-code-input-0"]');

    const token = generateSync({
      secret: process.env.CROWDSTRIKE_MFA_SECRET,
    });

    // Fill the 6 MFA boxes
    for (let i = 0; i < 6; i++) {
      await page.fill(`[name="verification-code-input-${i}"]`, token[i]);
    }

    await page.click('[data-test-selector="mfa-code-submit"]', { force: true });
  },

  async gotoUsers(page) {
    console.log("[CROWDSTRIKE] Navigating to Users page");
    await page.goto("https://falcon.us-2.crowdstrike.com/users-v2", {
      waitUntil: "networkidle"
    });
  },

  async loggedInCheck(page) {
    await page.waitForURL(
      url => url.href.includes("/hub") || url.href.includes("/users-v2"),
      { timeout: 15_000 }
    );
  }
};
