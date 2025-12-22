import axios from "axios";

export default async function slackUsers() {
  const users = new Set();
  let cursor;

  do {
    const r = await axios.get(
      "https://slack.com/api/users.list",
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_TOKEN}` // xoxb-
        },
        params: {
          limit: 200,
          team_id: process.env.SLACK_ENTERPRISE_ID, // 🔑 REQUIRED for org-installed apps
          ...(cursor ? { cursor } : {})
        }
      }
    );

    if (!r.data.ok) {
      console.warn("[SLACK] users.list error:", r.data.error);
      break;
    }

    for (const m of r.data.members || []) {
      // Best available privileged signal
      if (!m.is_owner && !m.is_primary_owner) continue;
      if (m.deleted || m.is_bot) continue;

      const email = m.profile?.email?.toLowerCase().trim();
      if (!email) continue;

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
