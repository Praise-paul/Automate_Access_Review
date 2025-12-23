export const crowdstrikeAdapter = {
  userDataDir: "playwright/profiles/crowdstrike",
  headless: false,

  // ✅ ADD THIS
  selector: '[data-test-selector="users-table"]',

  async login(page) {
    console.log("[CROWDSTRIKE] Opening Falcon");

    await page.goto(
      "https://falcon.us-2.crowdstrike.com/",
      { waitUntil: "domcontentloaded" }
    );

    console.log(
      "[CROWDSTRIKE] Ensure login (manual if prompted)"
    );
  },

  async gotoUsers(page) {
    console.log("[CROWDSTRIKE] Opening Users page");

    await page.goto(
      "https://falcon.us-2.crowdstrike.com/users-v2",
      { waitUntil: "domcontentloaded" }
    );

    await page.waitForSelector(
      '[data-test-selector="users-table"]',
      { timeout: 120_000 }
    );
  }
};



