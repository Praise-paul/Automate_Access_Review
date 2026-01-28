import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import https from 'https';
import httpAdapter from 'axios/lib/adapters/http.js';

axios.defaults.adapter = httpAdapter;
dotenv.config({
  override: true
});
const agent = new https.Agent({
  rejectUnauthorized: false 
});

const BASE_URL = 'https://neospace-team.atlassian.net';

function getAuthHeaders() {
  const auth = Buffer
    .from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`)
    .toString('base64');

  return {
    Authorization: `Basic ${auth}`,
    'X-Atlassian-Token': 'no-check',
    Accept: 'application/json'
  };
}

const jira = axios.create({
  baseURL: BASE_URL,
  httpsAgent: agent, 
  adapter: httpAdapter,
  headers: getAuthHeaders()
});



export async function updateJiraTicket(appName, unauthorized = [], missing = [], filePaths = []) {
    const headers = getAuthHeaders();
    const normalizeList = list =>
    list.map(u => (typeof u === "string" ? u : u.email));

    try {
        const jql = `project = "TEST" AND summary ~ "Validar acessos na plataforma: ${appName}" ORDER BY created DESC`;
        
        const search = await jira.post(`${BASE_URL}/rest/api/3/search/jql`, {
            jql,
            maxResults: 1,
            fields: ['summary', 'status'],
        }, { headers });

        if (!search.data.issues || search.data.issues.length === 0) {
            console.warn(`No ticket found for ${appName}`);
            return;
        }

        const issueKey = search.data.issues[0].key;
        console.log(` Found Ticket: ${issueKey}`);

        let commentContent;

if (unauthorized.length === 0 && missing.length === 0) {
    // Content for a Perfect Match
    commentContent = [
        {
            type: "paragraph",
            content: [
                { 
                    type: "text", 
                    text: `Access Review Completed: The access list for ${appName} matches perfectly with the JumpCloud User Group. No discrepancies found.`,
                    marks: [{ type: "strong" }] 
                }
            ]
        }
    ];
} else {
    // Your existing logic for reporting mismatches
    commentContent = [
        {
            type: "heading", attrs: { level: 3 },
            content: [{ type: "text", text: `Access Review Result: ${appName}` }]
        },
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Unauthorized:", marks: [{ type: "strong" }] },
                { type: "text", text: unauthorized.length ? `\n• ${normalizeList(unauthorized).join('\n• ')}` : " None" }
            ]
        },
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Missing:", marks: [{ type: "strong" }] },
                { type: "text", text: missing.length ? `\n• ${normalizeList(missing).join('\n• ')}` : " None" }

            ]
        }
    ];
}

const commentBody = {
    body: {
        type: "doc",
        version: 1,
        content: commentContent
    }
};

await jira.post(`${BASE_URL}/rest/api/3/issue/${issueKey}/comment`, commentBody, { headers });

        // 2. Upload Attachments (Handles absolute paths from main.js)
        for (const filePath of filePaths) {
            if (filePath && fs.existsSync(filePath)) {
                const form = new FormData();
                form.append('file', fs.createReadStream(filePath), {
                    filename: path.basename(filePath)
                });

                await jira.post(`${BASE_URL}/rest/api/3/issue/${issueKey}/attachments`, form, {
                    headers: { ...headers, ...form.getHeaders() }
                });
                console.log(`Attached: ${path.basename(filePath)}`);
            }
        }
        console.log(` Successfully updated ${issueKey}`);

    } catch (err) {
        console.error('Jira Update Failed:', err.response?.data || err.message);
    }
}

/**
 * Create a new ticket for an unauthorized user (Test Version)
 */
export async function createAccessTicket(userName, userEmail, groupName) {
    const headers = getAuthHeaders();
    const requestTypeId = "10797"; 

    const body = {
        "serviceDeskId": "397", 
        "requestTypeId": requestTypeId,
        "requestFieldValues": {
            // Name goes in the Summary
            "summary": `Request to Add ${userName} to Jumpcloud ${groupName}`,
            
            // Email goes in the Description (ADF format for Service Desk API)
            "description": `Automated Access Review Findings:
• User Name: ${userName}
• User Email: ${userEmail}
• Action: Missing from Jumpcloud group "${groupName}". 

  Please verify if this user should be granted access or if their account in the application should be deactivated.`
        }
    };

    try {
        const res = await jira.post(`${BASE_URL}/rest/servicedeskapi/request`, body, { headers });
        console.log(`✨ Created Request: ${res.data.issueKey} for ${userName}`);
        return res.data.issueKey;
    } catch (err) {
        console.error(`Failed to create ticket for ${userEmail}:`, err.response?.data || err.message);
    }
}

const debug = async () =>{
    console.log('JIRA_EMAIL:', process.env.JIRA_EMAIL);
console.log('JIRA_API_TOKEN exists:', !!process.env.JIRA_API_TOKEN);

  const res = await jira.get(`${BASE_URL}/rest/servicedeskapi/servicedesk`, { headers: getAuthHeaders() });
  console.log(res.data.values.map(sd => ({ id: sd.id, key: sd.projectKey })));
}

