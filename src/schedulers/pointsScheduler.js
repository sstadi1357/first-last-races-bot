// schedulers/pointsScheduler.js
const { formatMessageHistory } = require('../services/formatHistoryToSheets');
const cron = require('node-cron');
const { cronSchedule } = require('../config/mainConfig.js');
const { getLastMessages } = require('../utils/lastMessages');
const { updateScoresAndLeaderboard, storeLastMessages } = require('../services/firestoreService');
const { updateAllUserRoles } = require('../services/roleService');
const {spreadsheetId} = require('../config/mainConfig');
const db = require('../firebase');
const { logLeaderboardPointsToSheet, logHistoricLeaderboardsToSheet } = require('../services/pointsToSheet');

async function writeLeaderboardToHistory(serverId, date, rankings) {
    const serverRef = db.collection('servers').doc(serverId);
    const histRef = serverRef.collection('history-leaderboards');
    await histRef.doc(date).set({
        lastUpdated: new Date(),
        rankings
    });
}

function startScheduler(client) {
    const job = cron.schedule(cronSchedule.time, async () => {
        console.log('\n=== Starting Points Scheduler ===');
        
        // Calculate the date for yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toLocaleString("en-US", {
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
                const startOfDay = new Date(yesterday);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(yesterday);
                endOfDay.setHours(23, 59, 59, 999);

                console.log('\n🔎 Fetching last messages from Discord...');
                const { lastMessageInfo, secondLastMessageInfo } = await getLastMessages(guild, startOfDay, endOfDay);
                
                // Now lastMessageInfo and secondLastMessageInfo will include messageId property
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

                // Log leaderboard points to sheet and history (after leaderboard update)
                await writeLeaderboardToHistory(serverId, dateStr, leaderboardDoc.data().rankings);
                
                // Log historic leaderboards to sheet
                await logHistoricLeaderboardsToSheet(serverId);

                console.log(`\n✅ Completed processing for server ${serverId}`);
                
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
                        formatMessageHistory().catch(console.error);
                    }
                }
            }

            console.log('\n=== Points Scheduler Completed! ===');
        } catch (error) {
            console.error('\n❌ Error during points scheduling:', error);
        }
    }, {
        scheduled: true,
        timezone: cronSchedule.timezone
    });

    console.log(`Points scheduler started: ${cronSchedule.time} ${cronSchedule.timezone}`);
    return job;
}

module.exports = { startScheduler };