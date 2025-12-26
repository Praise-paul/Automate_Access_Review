export const ociAdapter = {
  userDataDir: "./.oci-profile",
  headless: false,
  selector: "input[aria-label='Items per page']", // Direct target from your HTML

  async login(page) {
    await page.goto("https://cloud.oracle.com/?tenant=neospaceai", { 
      waitUntil: "domcontentloaded" 
    });
    console.log("[OCI] Complete login + MFA if prompted");
    await page.waitForURL(url => url.href.includes("cloud.oracle.com"), { 
      timeout: 180_000 
    });
  },

  async gotoUsers(page) {
    console.log("[OCI] Opening Users page");
    
    // Use a high timeout and wait for load to be more stable
    await page.goto(
      "https://cloud.oracle.com/identity/domains/ocid1.domain.oc1..aaaaaaaa42jyl5v23n7zotvnxa3rja3fabgiuq5b4mbli2bscf7h2bbt5zuq/users?region=us-chicago-1",
      { waitUntil: "load", timeout: 120_000 }
    );

    console.log("[OCI] Waiting for Identity Domain UI to initialize...");

    // 1. Wait for the pagination input specifically (found in your HTML snippet)
    // The ID in your HTML was "_up6zkkymai9-input", which is dynamic, 
    // so we use the aria-label instead.
    const pageSizeInput = page.locator('input[aria-label="Items per page"]');

    try {
      // OCI can take a long time to "pop" the internal fragment
      await pageSizeInput.waitFor({ state: "visible", timeout: 90_000 });
      console.log("[OCI] Pagination controls detected.");

      // 2. Expand items per page
      console.log("[OCI] Attempting to expand list to max items...");
      await pageSizeInput.click({ force: true });
      
      // OCI dropdowns often appear at the bottom of the <body>
      const options = page.locator("ul.oj-listbox-results li, .oj-listbox-results li");
      await options.last().waitFor({ state: "visible", timeout: 15_000 });
      
      const count = await options.count();
      console.log(`[OCI] Found ${count} options, selecting the largest...`);
      await options.last().click();

      // 3. Wait for the "Busy" overlay to disappear or a static delay for refresh
      await page.waitForTimeout(8000); 
      console.log("[OCI] List expanded successfully.");

    } catch (err) {
      console.warn("[OCI] UI did not fully load or expand. Proceeding with current view.");
    }
  }
};