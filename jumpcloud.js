import axios from "axios";

const jc = axios.create({
  baseURL: "https://console.jumpcloud.com/api/v2",
  headers: {
    "x-api-key": process.env.JUMPCLOUD_API_KEY,
    "Accept": "application/json"
  },
  timeout: 30000
});

async function resolveUserEmails(userIds) {
  if (userIds.length === 0) return new Map();

  const res = await axios.post(
    "https://console.jumpcloud.com/api/search/users", // ✅ NO /v2
    {
      filter: { _id: { $in: userIds } },
      limit: userIds.length
    },
    {
      headers: {
        "x-api-key": process.env.JUMPCLOUD_API_KEY,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    }
  );

  const map = new Map();
  for (const u of res.data || []) {
    if (u.email && !u.system) {
      map.set(u._id, u.email.toLowerCase());
    }
  }

  return map;
}


export async function listGroups() {
  const all = [];
  const limit = 100;
  let skip = 0;

  while (true) {
    const r = await jc.get("/usergroups", { params: { limit, skip } });
    if (!Array.isArray(r.data) || r.data.length === 0) break;

    all.push(...r.data);
    skip += r.data.length;
  }

  return all;
}


export async function groupMembers(groupId) {
  const userIds = [];
  const limit = 100;
  let skip = 0;

  // 1️⃣ Get user IDs from group
  while (true) {
    const r = await jc.get(`/usergroups/${groupId}/members`, {
      params: { limit, skip }
    });

    if (!Array.isArray(r.data) || r.data.length === 0) break;

    r.data.forEach(m => {
      if (m.type === "user" && m.id) {
        userIds.push(m.id);
      }
    });

    skip += r.data.length;
  }

  if (userIds.length === 0) return new Set();

  // 2️⃣ Resolve IDs → emails (SEARCH API, NOT v2)
  const res = await axios.post(
    "https://console.jumpcloud.com/api/search/users",
    {
      filter: { _id: { $in: userIds } },
      limit: userIds.length
    },
    {
      headers: {
        "x-api-key": process.env.JUMPCLOUD_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    }
  );

  // 3️⃣ Build expected email set
  const emails = new Set();
  for (const u of res.data || []) {
    if (u.email && !u.system) {
      emails.add(u.email.toLowerCase());
    }
  }

  return emails;
}

