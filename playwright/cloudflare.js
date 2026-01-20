export const cloudflareAdapter = {
  userDataDir: "playwright/profiles/cloudflare",
  headless: false,

  selector: "table", // members table exists only post-login

  async login(page) {
  console.log("[CLOUDFLARE] Opening login page");

  await page.goto(
    "https://dash.cloudflare.com/login",
    { waitUntil: "domcontentloaded" }
  );

  console.log("[CLOUDFLARE] Use Google SSO and complete MFA");

  await page.waitForFunction(() => {
    const { hostname, pathname } = location;

    // Still inside Google SSO — ignore
    if (hostname.includes("google.com")) {
      return false;
    }

    // Must be back on Cloudflare dashboard
    if (!hostname.endsWith("cloudflare.com")) {
      return false;
    }

    // Still in Cloudflare login / MFA
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/two-factor")
    ) {
      return false;
    }

    // Logged-in Cloudflare UI signals
    return Boolean(
      document.querySelector("nav") ||
      document.querySelector('[href*="/members"]') ||
      document.querySelector('[data-testid="account-switcher"]')
    );
  }, { timeout: 5 * 60_000 });

  console.log("[CLOUDFLARE] Authentication FULLY completed");
},

  async gotoUsers(page) {
    console.log("[CLOUDFLARE] Opening Members page");

    await page.goto(
      "https://dash.cloudflare.com/a7b167e22d517a2054c054d1b5149694/members",
      { waitUntil: "domcontentloaded" }
    );

    // 🔒 Ensure we were not bounced back to login
    await page.waitForFunction(() => {
      return !location.pathname.startsWith("/login") &&
             !location.pathname.startsWith("/two-factor");
    }, { timeout: 60_000 });

    // Allow SPA hydration
    await page.waitForTimeout(6_000);

    console.log("[CLOUDFLARE] Members page loaded");
  }
};
