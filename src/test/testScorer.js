// test/testScorer.js
const { getLastMessages } = require('../utils/scoreCalculator');
const { updateScoresAndLeaderboard, storeLastMessages } = require('../services/firestoreService');
const db = require('../firebase');

async function testScoreCalculation(client, date = null) {
    console.log('\n=== Starting Test Score Calculation ===');
    
    // Use provided date or yesterday
    const testDate = date || new Date();
    testDate.setDate(testDate.getDate() - 1);
    const dateStr = testDate.toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split(',')[0].split('/').join('-');
    
    console.log(`\n📅 Testing scores for date: ${dateStr}`);

    try {
        // Get all servers
        console.log('\n🔍 Fetching servers from Firestore...');
        const serversRef = db.collection('servers');
        const serverDocs = await serversRef.listDocuments();
        console.log(`Found ${serverDocs.length} servers`);
        
        if (serverDocs.length === 0) {
            console.log('❌ No servers found in Firestore!');
            return;
        }

        for (const serverDoc of serverDocs) {
            const serverId = serverDoc.id;
            console.log(`\n📊 Processing server: ${serverId}`);
            
            const serverDocRef = db.collection('servers').doc(serverId);
            const dayDocRef = serverDocRef.collection('days').doc(dateStr);
            
            console.log('Checking for messages...');
            const dayDoc = await dayDocRef.get();

            if (!dayDoc.exists) {
                console.log(`❌ No document exists for ${dateStr} in server ${serverId}`);
                continue;
            }

            const messages = dayDoc.data().messages;
            if (!messages?.length) {
                console.log(`❌ No messages found for ${dateStr} in server ${serverId}`);
                continue;
            }

            console.log(`📝 Found ${messages.length} messages to process`);

            const guild = client.guilds.cache.get(serverId);
            if (!guild) {
                console.log(`❌ Could not find Discord server ${serverId} - bot might not be in server`);
                continue;
            }

            // Get time range for the test date
            const startOfDay = new Date(testDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(testDate);
            endOfDay.setHours(23, 59, 59, 999);

            console.log('\n🔎 Fetching last messages from Discord...');
            console.log(`Time range: ${startOfDay.toLocaleString()} to ${endOfDay.toLocaleString()}`);

            // Get last messages
            const { lastMessageInfo, secondLastMessageInfo } = await getLastMessages(guild, startOfDay, endOfDay);
            
            if (lastMessageInfo) {
                console.log(`✅ Last message by: ${lastMessageInfo.username}`);
            } else {
                console.log('❌ No last message found');
            }
            
            if (secondLastMessageInfo) {
                console.log(`✅ Second last message by: ${secondLastMessageInfo.username}`);
            } else {
                console.log('❌ No second last message found');
            }

            console.log('\n💾 Storing last messages in Firestore...');
            await storeLastMessages(serverDocRef, dateStr, lastMessageInfo, secondLastMessageInfo);

            console.log('\n📈 Calculating and updating scores...');
            await updateScoresAndLeaderboard(
                serverId,
                messages,
                lastMessageInfo,
                secondLastMessageInfo
            );

            // Verify the updates
            console.log('\n🔍 Verifying updates...');
            const leaderboardDoc = await serverDocRef.collection('leaderboard').doc('current').get();
            const usersCollection = await serverDocRef.collection('users').get();
            
            if (leaderboardDoc.exists) {
                console.log(`✅ Leaderboard updated with ${leaderboardDoc.data().rankings.length} users`);
            } else {
                console.log('❌ Leaderboard document not found after update!');
            }

            console.log(`✅ Users collection has ${usersCollection.size} users`);

            console.log(`\n✅ Completed processing for server ${serverId}`);
        }

        console.log('\n=== Test Score Calculation Completed! ===');
    } catch (error) {
        console.error('\n❌ Error during test score calculation:', error);
        throw error;
    }
}

module.exports = { testScoreCalculation };