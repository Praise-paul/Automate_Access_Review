import "dotenv/config";
import path from "path";
import fs from "fs";

export const ociAdapter = {
  userDataDir: "./.oci-profile",
  headless: false,

  async login(page) {
    console.log("[OCI] Opening OCI console (SSO may be required)");

    await page.goto(
      `https://cloud.oracle.com/?region=${process.env.OCI_REGION}`,
      { waitUntil: "domcontentloaded" }
    );
  },

  async loggedInCheck(page) {
    await page.evaluate(() => true);
  },

  async gotoGroupUsers(page, groupId, groupName) {
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
