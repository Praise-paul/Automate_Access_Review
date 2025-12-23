export const slackAdapter = {
  userDataDir: "playwright/profiles/slack",
  headless: false,

  // ✅ THIS WAS MISSING
  selector: '[data-qa="org_members_table"]',

  async login(page) {
    console.log("[SLACK] Opening Slack People page");

    await page.goto(
      "https://app.slack.com/manage/E08D7Q2A73R/people",
      { waitUntil: "domcontentloaded" }
    );

    console.log(
      "[SLACK] Complete JumpCloud / Slack login if prompted"
    );
  },

  async gotoUsers(page) {
    console.log("[SLACK] Waiting for Slack to finish rehydration");

    await page.waitForURL(
      url =>
        url.href.includes("/manage/") ||
        url.href.includes("enterprise.slack.com"),
      { timeout: 5 * 60_000 }
    );

    await page.waitForTimeout(10_000);

    const adminFilter =
      '[data-qa="org_members_table_header-filter-button"]';

    await page.waitForSelector(adminFilter, {
      timeout: 3 * 60_000
    });

    console.log("[SLACK] Admin People UI detected");

    await page.click(adminFilter);
    await page.click('text=Org Admins & Owners');
    await page.waitForTimeout(1500);
  }
};
