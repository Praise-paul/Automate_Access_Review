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

    await page.goto(
      "https://app.slack.com/manage/E08D7Q2A73R/people",
      { waitUntil: "domcontentloaded" }
    );

    console.log("[SLACK] Login/MFA if prompted");
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
