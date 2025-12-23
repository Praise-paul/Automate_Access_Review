import axios from "axios";

export default async function slackUsers() {
  const users = new Set();
  let cursor;

  do {
    const r = await axios.get(
      "https://slack.com/api/users.list",
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_TOKEN}`
        },
        params: {
          limit: 200,
          team_id: process.env.SLACK_ENTERPRISE_ID, 
          ...(cursor ? { cursor } : {})
        }
      }
    );

    if (!r.data.ok) {
      console.warn("[SLACK] users.list error:", r.data.error);
      break;
    }

    // Inside slackUsers() loop...
    for (const m of r.data.members || []) {
      if (m.deleted || m.is_bot) continue;

      // 1. Identify Org-level Admins/Owners
      // In Enterprise Grid, the source of truth for the Org Dashboard is here:
      const isOrgOwner = m.enterprise_user?.is_owner === true;
      const isOrgAdmin = m.enterprise_user?.is_admin === true;
      const isPrimaryOwner = m.is_primary_owner === true;

      // ONLY include if they are an Org Owner, Org Admin, or Primary Owner
      if (!isOrgOwner && !isOrgAdmin && !isPrimaryOwner) continue;

      const email = m.profile?.email?.toLowerCase().trim();
      if (!email) continue;

      // 2. Filter out system integrations
      if (
        email.startsWith("sys_") ||
        email.includes("integration") ||
        email.includes("falcon")
      ) continue;

      users.add(email);
    }

    cursor = r.data.response_metadata?.next_cursor || null;
  } while (cursor);

  console.log("[SLACK] Owners returned (best effort):", [...users]);
  return users;
}
