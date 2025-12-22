import axios from "axios";

export default async function slackUsers() {
  const users = new Set();
  let cursor;

  do {
    const r = await axios.get(
      "https://slack.com/api/users.list",
      {
        headers: { Authorization: `Bearer ${process.env.SLACK_TOKEN}` },
        params: cursor ? { cursor } : {}
      }
    );

    for (const m of r.data.members || []) {
      const email = m.profile?.email;
      if (email) users.add(email.toLowerCase());
    }

    cursor = r.data.response_metadata?.next_cursor;
  } while (cursor);

  return users;
}
