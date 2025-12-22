import axios from "axios";

const BASE = process.env.CS_BASE_URL;

async function getToken() {
  const r = await axios.post(
    `${BASE}/oauth2/token`,
    new URLSearchParams({
      client_id: process.env.CS_CLIENT_ID,
      client_secret: process.env.CS_CLIENT_SECRET
    })
  );
  return r.data.access_token;
}

export default async function crowdstrikeUsers() {
  const token = await getToken();

  // Step 1: get user UUIDs
  const idsRes = await axios.get(
    `${BASE}/user-management/queries/users/v1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      params: { limit: 500 }
    }
  );

  if (!idsRes.data.resources?.length) {
    return new Set();
  }

  // Step 2: resolve user details
  const detailsRes = await axios.post(
    `${BASE}/user-management/entities/users/GET/v1`,
    { ids: idsRes.data.resources },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  // Normalize emails
  const users = new Set();

for (const u of detailsRes.data.resources || []) {
  const uid = u.uid?.toLowerCase();

  if (!uid) continue;

  // --- SKIP SYSTEM / SERVICE USERS ---
  if (uid.startsWith("sys_")) continue;
  if (!uid.includes("@")) continue;
  if (u.first_name === "Falcon") continue;

  if (u.status === "active") {
    users.add(uid);
  }
}


  return users;
}
