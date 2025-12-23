export const ociAdapter = {
  userDataDir: "./.oci-profile",
  headless: false,

  // Dummy selector so generic code doesn't break
  selector: "body",

  async login(page) {
    await page.goto(
      "https://cloud.oracle.com/?tenant=neospaceai",
      { waitUntil: "domcontentloaded" }
    );

    console.log("[OCI] Complete login + MFA if prompted");

    // Wait until we are inside OCI console
    await page.waitForURL(
      url => url.href.startsWith("https://cloud.oracle.com"),
      { timeout: 180_000 }
    );
  },

  async gotoUsers(page) {
    console.log("[OCI] Opening Users page");

    await page.goto(
      "https://cloud.oracle.com/identity/domains/ocid1.domain.oc1..aaaaaaaa42jyl5v23n7zotvnxa3rja3fabgiuq5b4mbli2bscf7h2bbt5zuq/users?region=us-chicago-1",
      { waitUntil: "domcontentloaded" }
    );

    // IMPORTANT: Wait for final redirected URL (post SSO)
    await page.waitForURL(
      url => url.href.includes("/identity/domains/"),
      { timeout: 180_000 }
    );

    console.log("[OCI] Users page reached, allowing UI to settle");

    // 🔒 HARD SETTLE WINDOW (bounded, never hangs)
    await page.waitForTimeout(10_000);

    // Optional: try to increase page size, but NEVER wait on it
    try {
      const itemsInput = page.locator('input[aria-label="Items per page"]');
      if (await itemsInput.count()) {
        await itemsInput.click();
        await itemsInput.press("Control+A");
        await itemsInput.type("100");
        await itemsInput.press("Enter");
        await page.keyboard.press("Tab");
      }
    } catch {
      // Ignore — evidence does not depend on this
    }

    // Final small settle before screenshot
    await page.waitForTimeout(3_000);
  }
};
