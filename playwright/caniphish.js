export const caniphishAdapter = {
  userDataDir: "playwright/profiles/caniphish",
  headless: false,

  // We will wait on real admin UI content
  selector: "body",

  async login(page) {
    console.log("[CANIPHISH] Opening login page");

    await page.goto(
      "https://caniphish.com/Auth/Login",
      { waitUntil: "domcontentloaded" }
    );

    console.log("[CANIPHISH] Enter email + password, complete MFA if prompted");

    // Wait until we are inside the platform
    await page.waitForURL(
      url => url.href.startsWith("https://caniphish.com/platform"),
      { timeout: 5 * 60_000 }
    );

    console.log("[CANIPHISH] Login successful");
  },

  async gotoUsers(page) {
    console.log("[CANIPHISH] Opening Admin / Tenant settings");

    await page.goto(
      "https://caniphish.com/platform/settings?queryType=ManageTenant",
      { waitUntil: "domcontentloaded" }
    );

    // Allow SPA hydration
    await page.waitForTimeout(8_000);

    console.log("[CANIPHISH] Admin settings page loaded");
  }
};
