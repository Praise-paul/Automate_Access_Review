import 'dotenv/config'; 
import './playwright/crowdstrike.js';
import './playwright/slack.js';


import App from "./app.js";
import { listGroups, groupMembers } from "./jumpcloud.js";
import { confirmApp, selectGroups, filterGroupsForApp } from "./groupSelector.js";

import slackUsers from "./slack.js";
import crowdstrikeUsers from "./crowdstrike.js";
import ociUsers from "./oci.js";
import cloudflareUsers from "./cloudflare.js";



import writeCSV from "./report.js";
import { diffSets } from "./diff.js";

import { captureUserListEvidence } from "./playwright/index.js";
import { ociAdapter } from './playwright/oci.js';
import { slackAdapter } from "./playwright/slack.js";
import { crowdstrikeAdapter } from "./playwright/crowdstrike.js";
import { caniphishAdapter } from "./playwright/caniphish.js";
import { csatAdapter } from "./playwright/csat.js";
import { cloudflareAdapter } from "./playwright/cloudflare.js";


/* ============================
   FETCHERS
============================ */

const FETCHERS = {
  slack: slackUsers,
  crowdstrike: crowdstrikeUsers,
  cloudflare: cloudflareUsers,
  oci: ociUsers,
};

/* ============================
   LOAD JUMPCLOUD GROUPS ONCE
============================ */

console.log("[INIT] Fetching JumpCloud groups...");
const ALL_JC_GROUPS = await listGroups();
console.log(`[INIT] Loaded ${ALL_JC_GROUPS.length} groups`);

/* ============================
   MAIN LOOP
============================ */

for (const app of Object.keys(App)) {
  console.log(`\n=== ${app.toUpperCase()} ===`);

  if (!(await confirmApp(app))) {
    console.log(`Skipping ${app.toUpperCase()}`);
    continue;
  }

  const cfg = App[app];


  /* ----- FILTER GROUPS FOR THIS APP ----- */
  const relevantGroups = filterGroupsForApp(
    app,
    ALL_JC_GROUPS,
    App
  );

  if (!relevantGroups.length) {
    console.log("No relevant JumpCloud groups found, skipping.");
    continue;
  }

  /* ----- GROUP SELECTION ----- */
  const selectedGroups =
    app === "oci"
      ? relevantGroups
      : selectGroups(app, relevantGroups);

  if (!selectedGroups.length) {
    console.log("No groups selected, skipping.");
    continue;
  }

  console.log("Selected groups:");
  selectedGroups.forEach(g =>
    console.log(` - ${g.name} (${g.id})`)
  );

  /* ============================
     OCI ACCESS REVIEW
  ============================ */

  if (app === "oci") {
    const ociResults = await ociUsers({ groups: selectedGroups });

    const ociCsvRows = [];

    for (const group of selectedGroups) {
      const expected = await groupMembers(group.id);
      const actual = ociResults[group.name]?.users || new Set();


      const { unauthorized, missing } = diffSets(expected, actual);

      unauthorized.forEach(email =>
        ociCsvRows.push({
          email,
          status: "unauthorized",
          group: group.name
        })
      );

      missing.forEach(email =>
        ociCsvRows.push({
          email,
          status: "missing",
          group: group.name
        })
      );

    }

    if (ociCsvRows.length) {
      await writeCSV({
        app: "oci",
        group: "oci", // 👈 single file name
        rows: ociCsvRows
      });
    }

    /* ----- OCI UI EVIDENCE (GROUP-WISE) ----- */
    const ociUiGroups = Object.entries(ociResults).map(
      ([name, v]) => ({
        name,
        groupId: v.groupId
      })
    );

    console.log(`[OCI] UI groups to capture: ${ociUiGroups.length}`);
    ociUiGroups.forEach(g =>
      console.log(`  → ${g.name} (${g.groupId})`)
    );

    if (!ociUiGroups.length) {
      console.warn("[OCI] No valid OCI groups found for UI evidence — skipping UI capture");
    } else {
      await captureUserListEvidence(
        "oci",
        ociAdapter,
        ociUiGroups
      );
    }

    continue;
  }

  /* ============================
     OTHER APPS (Slack / CrowdStrike)
  ============================ */

  const expected = new Set();
  for (const g of selectedGroups) {
    const members = await groupMembers(g.id);
    members.forEach(u => expected.add(u));
  }
// 🔒 Evidence-only applications (no API comparison)
if (cfg.evidenceOnly) {
  console.log(`\n[${app.toUpperCase()}] Evidence-only application`);
  console.log("Skipping API comparison, capturing UI evidence only");

  // Use the standard adapter routing
  if (app === "caniphish") {
    await captureUserListEvidence("caniphish", caniphishAdapter);
  } else if (app === "csat") {
    await captureUserListEvidence("csat", csatAdapter);
  } else {
    throw new Error(
      `Evidence-only app '${app}' has no Playwright adapter defined`
    );
  }

  continue;
}

const actual = await FETCHERS[app]({ groups: selectedGroups });

  const { unauthorized, missing } = diffSets(expected, actual);

  if (unauthorized.length) {
    await writeCSV({
      app,
      group: "ALL",
      type: "unauthorized",
      rows: unauthorized.map(email => ({ email }))
    });
  }

  if (missing.length) {
    await writeCSV({
      app,
      group: "ALL",
      type: "missing",
      rows: missing.map(email => ({ email }))
    });
  }

  if (app === "slack") {
    await captureUserListEvidence("slack", slackAdapter);
  }

  if (app === "crowdstrike") {
    await captureUserListEvidence("crowdstrike", crowdstrikeAdapter);
  }

  if (app === "cloudflare") {
  console.log("\n[CLOUDFLARE] Capturing UI evidence...");
  await captureUserListEvidence("cloudflare", cloudflareAdapter);
}


}

console.log("\n✔ Access review completed");
