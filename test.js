import axios from "axios";

const r = await axios.get(
  "https://slack.com/api/admin.users.list",
  {
    headers: { Authorization: `Bearer ${process.env.SLACK_TOKEN}` },
    params: {
      enterprise_id: process.env.SLACK_ENTERPRISE_ID,
      limit: 1
    }
  }
);

console.log(r.data);
