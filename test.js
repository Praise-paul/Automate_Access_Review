import axios from "axios";
import "dotenv/config";

const BASE = process.env.CS_BASE_URL;

const token = (
  await axios.post(
    `${BASE}/oauth2/token`,
    new URLSearchParams({
      client_id: process.env.CS_CLIENT_ID,
      client_secret: process.env.CS_CLIENT_SECRET
    })
  )
).data.access_token;

const users = await axios.get(
  `${BASE}/user-management/queries/users/v1`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    },
    params: {
      limit: 500
    }
  }
);

console.log(users.data);



const details = await axios.post(
  `${BASE}/user-management/entities/users/GET/v1`,
  {
    ids: users.data.resources
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  }
);

console.log(details.data.resources);


console.log(details.data);
