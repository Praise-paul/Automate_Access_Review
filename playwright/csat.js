import 'dotenv/config'; 
export const csatAdapter = {
  userDataDir: "playwright/profiles/csat",
  headless: false,
  selector: "body",
  name: "CSAT",
  dashboardUrl: "https://csat.cisecurity.org/accounts/administration/",
  async isLoggedIn(page) {
    const isAuthPath = page.url().includes("/accounts/login") || page.url().includes("/verify/otp");
    // Look for the "Logout" link or Admin nav
    const hasAdminUI = await page.locator('[href*="logout"], [href*="/administration/"]').first().isVisible();
    return !isAuthPath && hasAdminUI;
  },

  async login(page) {
    console.log("[CSAT] Opening login page");

    await page.goto(
      "https://csat.cisecurity.org/accounts/login/",
      { waitUntil: "domcontentloaded" }
    );

    console.log("[CSAT] Complete login + OTP if prompted");

    /**
     * 🔒 HARD AUTH GATE
     * Wait until OTP form is gone AND
     * a logged-in-only UI element exists
     */
    await page.waitForFunction(() => {
      const path = location.pathname;

      // Still in login / OTP flow
      if (path.startsWith("/accounts/login") || path.startsWith("/accounts/verify/otp")) {
        return false;
      }

      // OTP form still visible
      const otpInput =
        document.querySelector('input[name="otp"]') ||
        document.querySelector('input[type="tel"]');

      if (otpInput) return false;

      // Logged-in UI signals (any one is enough)
      return Boolean(
        document.querySelector("nav") ||
        document.querySelector('[href*="logout"]') ||
        document.querySelector('[href*="/accounts/administration"]')
      );
    }, { timeout: 5 * 60_000 });

    console.log("[CSAT] Authentication FULLY completed");
  },

  async gotoUsers(page) {
    console.log("[CSAT] Opening administration page");

    await page.goto(
      "https://csat.cisecurity.org/accounts/administration/",
      { waitUntil: "domcontentloaded" }
    );

    // 🔒 Ensure we were NOT bounced back into OTP
    await page.waitForFunction(() => {
      return !location.pathname.startsWith("/accounts/verify/otp");
    }, { timeout: 60_000 });

    // Let admin UI settle
    await page.waitForTimeout(4_000);

    console.log("[CSAT] Administration page loaded");
  }
};
