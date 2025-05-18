const { formatMessageHistory } = require('../services/formatHistoryToSheets');
const { getLastMessages } = require('../utils/lastMessages');
const { updateScoresAndLeaderboard, storeLastMessages } = require('../services/firestoreService');
const { updateAllUserRoles } = require('../services/roleService');
const { spreadsheetId } = require('../config/mainConfig');
const db = require('../firebase');

/**
 * Process points for all servers for a specific date
 * @param {Object} client - Discord client
 * @param {Date} [targetDate] - Date to process (defaults to yesterday)
 * @returns {Promise<void>}
 */
async function processPoints(targetDate) {
    console.log('\n=== Starting Points Processing ===');
    
    // Calculate the date (defaults to yesterday if no date provided)
    const dateToProcess = targetDate || new Date();
    if (!targetDate) {
        dateToProcess.setDate(dateToProcess.getDate() - 1);
    }
    
    const dateStr = dateToProcess.toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split(',')[0].split('/').join('-');
    
    console.log(`\n📅 Processing points for date: ${dateStr}`);

    try {
        // Fetch all servers using listDocuments
        console.log('\n🔍 Fetching servers from Firestore...');
        const serverDocs = await db.collection('servers').listDocuments();
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

            // Get time range for the date
            const startOfDay = new Date(dateToProcess);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateToProcess);
            endOfDay.setHours(23, 59, 59, 999);

            console.log('\n🔎 Fetching last messages from Discord...');
            const { lastMessageInfo, secondLastMessageInfo } = await getLastMessages(guild, startOfDay, endOfDay);
            
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

            // Update roles after scores and leaderboard are updated
            await updateAllUserRoles(guild, serverId, dateStr);

            console.log(`\n✅ Completed processing for server ${serverId}`);
        }

        // Check if we should update the sheets
        if (spreadsheetId) {
            // Get current date to check if it's the 1st of the month
            const today = new Date();
            // Use LA timezone to be consistent with other date calculations
            const todayLA = new Date(today.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
            const isFirstOfMonth = todayLA.getDate() === 1;
            
            if (isFirstOfMonth) {
                console.log('\n📊 First day of the month detected. Processing both current and previous month sheets...');
                
                // Calculate previous month and year
                const currentMonth = todayLA.getMonth() + 1; // JavaScript months are 0-indexed
                const currentYear = todayLA.getFullYear();
                
                // Previous month logic (handling December to January transition)
                const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
                
                try {
                    // First process previous month's data
                    console.log(`Processing previous month's sheet (${prevMonth}/${prevYear})...`);
                    await formatMessageHistory(prevMonth, prevYear);
                    
                    // Then process current month's data (which may only have 1 day of data so far)
                    console.log(`Processing current month's sheet (${currentMonth}/${currentYear})...`);
                    await formatMessageHistory(currentMonth, currentYear);
                    
                    console.log('✅ Both months processed successfully');
                } catch (error) {
                    console.error('❌ Error processing month sheets:', error);
                }
            } else {
                // Regular day - just update current month
                console.log('\n📊 Updating current month sheet...');
                await formatMessageHistory().catch(console.error);
            }
        }

        console.log('\n=== Points Processing Completed! ===');
    } catch (error) {
        console.error('\n❌ Error during points processing:', error);
        throw error; // Re-throw to allow CLI to handle it
    }
}

module.exports = { processPoints };