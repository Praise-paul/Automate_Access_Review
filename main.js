import "dotenv/config";

import App from "./app.js";
import { listGroups, groupMembers } from "./jumpcloud.js";
import { confirmApp, selectGroups } from "./groupSelector.js";

import slackUsers from "./slack.js";
import crowdstrikeUsers from "./crowdstrike.js";
import ociUsers from "./oci.js";

import writeCSV from "./report.js";

import { captureUserListEvidence } from "./playwright/index.js";
import { crowdstrikeAdapter } from "./playwright/crowdstrike.js";
import { slackAdapter } from "./playwright/slack.js";
import { ociAdapter } from "./playwright/oci.js";

const FETCHERS = {
  slack: slackUsers,
  crowdstrike: crowdstrikeUsers,
  oci: ociUsers
};

/* ============================
   LOAD ALL JUMPCLOUD GROUPS
============================ */

const jcGroups = await listGroups();

console.log("=== ALL JUMPCLOUD GROUPS ===");
jcGroups.forEach(g => {
  console.log({ name: g.name, description: g.description });
});
console.log("================================");

/* ============================
   MAIN APP LOOP
============================ */

for (const app of Object.keys(App)) {
  console.log(`\n=== ${app.toUpperCase()} ===`);

  /* ----- APP-LEVEL CONFIRMATION ----- */
  const proceed = await confirmApp(app);
  if (!proceed) {
    console.log(`Skipping ${app.toUpperCase()}`);
    continue;
  }

  const cfg = App[app];
  let matches;

  /* ----- GROUP DISCOVERY ----- */
  if (app === "oci") {
    matches = jcGroups.filter(
      g =>
        typeof g.name === "string" &&
        g.name.startsWith(App.oci.autoGroupPrefix)
    );
  } else {
    matches = jcGroups.filter(g => {
      const text = ((g.name || "") + " " + (g.description || "")).toLowerCase();
      return Array.isArray(cfg.keywords) &&
        cfg.keywords.some(k => text.includes(k));
    });
  }

  if (!matches.length) {
    console.log("No matching JumpCloud groups, skipping.");
    continue;
  }

  /* ----- GROUP SELECTION ----- */
  let selected;

  if (app === "oci") {

    selected = matches;
  } else {
    selected = selectGroups(app, matches);
  }

  console.log("\n==============================");
  console.log(`APPLICATION: ${app.toUpperCase()}`);
  console.log("==============================");
  console.log("Selected JumpCloud groups:");

  selected.forEach(g => console.log(` - ${g.name} (${g.id})`));

  if (!selected.length) {
    console.log("No groups selected, skipping.");
    continue;
  }

  if (app === "oci") {
    const ociResults = [];

    for (const g of selected) {
      const expectedRaw = await groupMembers(g.id);
      const expected = new Set([...expectedRaw].map(u => u.toLowerCase().trim()));

      const actualRaw = await FETCHERS.oci({ groups: [g] });
      const actual = new Set([...actualRaw].map(u => u.toLowerCase().trim()));

      const unauthorized = [...actual].filter(u => !expected.has(u));
      const missing = [...expected].filter(u => !actual.has(u));

      if (unauthorized.length || missing.length) {
        ociResults.push({ group: g.name, unauthorized, missing });
      }
    }

    console.log("\n--- OCI ACCESS REVIEW SUMMARY ---");

    if (!ociResults.length) {
      console.log("✅ All OracleOCI-* groups are in sync");
    } else {
      for (const r of ociResults) {
        console.log(`\n❌ Group: ${r.group}`);

        if (r.unauthorized.length) {
          console.log("  Unauthorized users:");
          r.unauthorized.forEach(u => console.log("   -", u));
        }

        if (r.missing.length) {
          console.log("  Missing users:");
          r.missing.forEach(u => console.log("   -", u));
        }
      }
    }

    // ✅ ADD THIS HERE (before continue)
    console.log("\n[OCI] Capturing UI evidence...");
    await captureUserListEvidence("oci", ociAdapter);

    continue;
  }


  const expected = new Set();
  for (const g of selected) {
    const members = await groupMembers(g.id, true);
    members.forEach(email => {
      if (email) expected.add(email.toLowerCase().trim());
    });
  }

  const actualRaw = await FETCHERS[app]({ groups: selected });
  const actual = new Set(
    [...actualRaw].map(e => e.toLowerCase().trim())
  );

  const unauthorized = [...actual].filter(u => !expected.has(u));
  const missing = [...expected].filter(u => !actual.has(u));

  console.log("\n--- ACCESS REVIEW RESULTS ---");

  if (!unauthorized.length) {
    console.log("No unauthorized users");
  } else {
    console.log("UNAUTHORIZED USERS:");
    unauthorized.forEach(u => console.log(" -", u));
  }

  if (!missing.length) {
    console.log("No missing users");
  } else {
    console.log("MISSING USERS:");
    missing.forEach(u => console.log(" -", u));
  }

  /* ----- CSV EXPORT ----- */
  if (unauthorized.length) {
    await writeCSV(
      `${app}_unauthorized.csv`,
      unauthorized.map(u => ({ email: u }))
    );
  }

  if (missing.length) {
    await writeCSV(
      `${app}_missing.csv`,
      missing.map(u => ({ email: u }))
    );
  }

  /* ----- UI EVIDENCE ----- */
  if (app === "crowdstrike") {
    console.log("\n[CROWDSTRIKE] Capturing UI evidence...");
    await captureUserListEvidence("crowdstrike", crowdstrikeAdapter);
  }

  if (app === "slack") {
    console.log("\n[SLACK] Capturing UI evidence...");
    await captureUserListEvidence("slack", slackAdapter);
  }

  if (app === "oci") {
    console.log("\n[OCI] Capturing UI evidence...");
    await captureUserListEvidence("oci", ociAdapter);
  }
}

console.log("\n✔ Access review completed");
