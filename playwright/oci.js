import "dotenv/config";
import path from "path";
import fs from "fs";

export const ociAdapter = {
  userDataDir: "./.oci-profile",
  headless: false,

 async login(page) {
  console.log("[OCI] Opening OCI console (SSO may be required)");

  // Phase 1: trigger SSO
  await page.goto(
    `https://cloud.oracle.com/?region=${process.env.OCI_REGION}`,
    { waitUntil: "domcontentloaded" }
  );

  console.log("[OCI] Complete login + MFA if prompted");

  // Phase 2: FORCE identity console bootstrap
  const identityHome =
    `https://cloud.oracle.com/identity/domains/` +
    `${process.env.OCI_DOMAIN_OCID}` +
    `/users?region=${process.env.OCI_REGION}`;

  console.log("[OCI] Forcing Identity console load");
  await page.goto(identityHome, { waitUntil: "domcontentloaded" });
}
,

  async loggedInCheck(page) {
  console.log("[OCI] Verifying Identity console readiness");

  // Wait until we are on an identity page
  await page.waitForURL(
    url => url.href.includes("/identity/domains/"),
    { timeout: 180_000 }
  );

  console.log("[OCI] Identity console is ready");
}


,

  async gotoGroupUsers(page, groupId, groupName) {
      await this.loggedInCheck(page);

    const groupUrl =
      `https://cloud.oracle.com/identity/domains/` +
      `${process.env.OCI_DOMAIN_OCID}` +
      `/groups/${groupId}/group-users` +
      `?region=${process.env.OCI_REGION}`;

    console.log(`[OCI] Navigating to group users: ${groupName}`);
    console.log(groupUrl);

    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });


    console.log(`[OCI] Group page loaded: ${groupName}`);

    await page.waitForTimeout(5_000);
  }
};
