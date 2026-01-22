import 'dotenv/config';
import { ImapFlow } from 'imapflow';

async function fetchLatestCSATCode() {
  console.log('🔵 Starting fetchLatestCSATCode');

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });

  try {
    console.log('🟡 Connecting to IMAP server...');
    await client.connect();
    console.log('✅ Connected');

    console.log('🟡 Locking INBOX...');
    const lock = await client.getMailboxLock('INBOX');
    console.log('✅ INBOX locked');

    try {
      const sinceDate = new Date(Date.now() - 2 * 60 * 1000);
      console.log('🟡 Searching emails since:', sinceDate.toISOString());

      const messageIds = await client.search({
        unseen: true,
        since: sinceDate
      });

      console.log(`📨 Messages found: ${messageIds.length}`);

      if (!messageIds.length) {
        console.log('⚠️ No recent unseen emails found');
        return null;
      }

      const latestId = messageIds.at(-1);
      console.log('🟡 Fetching message ID:', latestId);

      const message = await client.fetchOne(latestId, { source: true });

      if (!message || !message.source) {
        console.log('❌ Message has no body');
        return null;
      }

      const body = message.source.toString();
      console.log('📄 Email body received');

      const match = body.match(/\b\d{6}\b/);

      if (match) {
        console.log('✅ CSAT Code found:', match[0]);
        return match[0];
      } else {
        console.log('❌ No 6-digit code found in email');
        return null;
      }

    } finally {
      console.log('🔓 Releasing INBOX lock');
      lock.release();
    }

  } catch (error) {
    console.error('🔥 Error occurred:', error);
    throw error;
  } finally {
    console.log('🔴 Logging out from IMAP');
    await client.logout();
  }
}

/* -------------------- RUN FUNCTION -------------------- */

(async () => {
  console.log('🚀 Running CSAT fetch test...\n');

  try {
    const code = await fetchLatestCSATCode();
    console.log('\n🎯 FINAL RESULT:', code);
  } catch (err) {
    console.error('\n💥 Test failed:', err.message);
  }

  console.log('\n🏁 Test finished');
})();
