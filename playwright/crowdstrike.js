export const crowdstrikeAdapter = {
  userDataDir: "playwright/profiles/crowdstrike",
  headless: false,

  selector: '[data-test-selector="users-table"], table',

  async login(page) {
    console.log("[CROWDSTRIKE] Opening Falcon");

    await page.goto(
      "https://falcon.us-2.crowdstrike.com/",
      { waitUntil: "domcontentloaded" }
    );

    console.log("[CROWDSTRIKE] Login if prompted");
  },

  async gotoUsers(page) {
    console.log("[CROWDSTRIKE] Opening Users page");

    await page.goto(
      "https://falcon.us-2.crowdstrike.com/users-v2",
      { waitUntil: "domcontentloaded" }
    );
  },

  async loggedInCheck(page) {
    await page.waitForURL(
      url => url.hostname.includes("crowdstrike.com"),
      { timeout: 30_000 }
    );
  }
};
