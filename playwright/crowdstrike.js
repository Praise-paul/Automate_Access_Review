
export const crowdstrikeAdapter = {
  baseUrl: "https://falcon.us-2.crowdstrike.com",
  userDataDir: "playwright/profiles/crowdstrike",

  // MUST remain false for Falcon
  headless: true,

  usersTableSelector: 'tr[data-test-selector="table-row"]',

  async login(page) {
    console.log("[CROWDSTRIKE] Opening Falcon (persistent profile)");

    await page.goto(this.baseUrl, {
      waitUntil: "domcontentloaded"
    });

    console.log(
      "[CROWDSTRIKE] Waiting for Falcon shell (any dashboard)"
    );

    // ✅ DO NOT wait for a specific URL
    // ✅ Wait for global Falcon UI instead
    await page.waitForSelector(
      '[data-test-selector="falcon-top-bar"]',
      { timeout: 120_000 }
    );

    console.log("[CROWDSTRIKE] Falcon UI ready");
  },

  async gotoUsers(page) {
    await page.goto(`${this.baseUrl}/users-v2`, {
      waitUntil: "domcontentloaded"
    });
  }
};


