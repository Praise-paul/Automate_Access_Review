import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const BASE_URL = 'https://neospace-team.atlassian.net';

function getAuthHeaders() {
    const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
    return {
        'Authorization': `Basic ${auth}`,
        'X-Atlassian-Token': 'no-check',
        'Accept': 'application/json'
    };
}

export async function updateJiraTicket(appName, unauthorized = [], missing = [], filePaths = []) {
    const headers = getAuthHeaders();
    
    try {
        const jql = `project = "TEST" AND summary ~ "Validar acessos na plataforma: ${appName}" ORDER BY created DESC`;
        
        const search = await axios.post(`${BASE_URL}/rest/api/3/search/jql`, {
            jql,
            maxResults: 1,
            fields: ['summary', 'status'],
        }, { headers });

        if (!search.data.issues || search.data.issues.length === 0) {
            console.warn(`⚠️ No ticket found for ${appName}`);
            return;
        }

        const issueKey = search.data.issues[0].key;
        console.log(`✅ Found Ticket: ${issueKey}`);

        // 1. Build Comment
        const commentBody = {
            body: {
                type: "doc", version: 1,
                content: [
                    {
                        type: "heading", attrs: { level: 3 },
                        content: [{ type: "text", text: `Access Review Result: ${appName}` }]
                    },
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Unauthorized:", marks: [{ type: "strong" }] },
                            { type: "text", text: unauthorized.length ? `\n• ${unauthorized.join('\n• ')}` : " None" }
                        ]
                    },
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Missing:", marks: [{ type: "strong" }] },
                            { type: "text", text: missing.length ? `\n• ${missing.join('\n• ')}` : " None" }
                        ]
                    }
                ]
            }
        };

        await axios.post(`${BASE_URL}/rest/api/3/issue/${issueKey}/comment`, commentBody, { headers });

        // 2. Upload Attachments (Handles absolute paths from main.js)
        for (const filePath of filePaths) {
            if (filePath && fs.existsSync(filePath)) {
                const form = new FormData();
                form.append('file', fs.createReadStream(filePath), {
                    filename: path.basename(filePath)
                });

                await axios.post(`${BASE_URL}/rest/api/3/issue/${issueKey}/attachments`, form, {
                    headers: { ...headers, ...form.getHeaders() }
                });
                console.log(`📎 Attached: ${path.basename(filePath)}`);
            }
        }
        console.log(`🚀 Successfully updated ${issueKey}`);

    } catch (err) {
        console.error('❌ Jira Update Failed:', err.response?.data || err.message);
    }
}