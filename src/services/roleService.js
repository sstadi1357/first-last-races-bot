// services/roleService.js
const db = require('../firebase');
const {flairAnnouncement, flairAnnouncementChannelId, ROLES} = require('../config/mainConfig');
const sheets = require('../sheets');
const { spreadsheetId } = require('../config/mainConfig');

async function announceRole(guild, member, roleName, yesterdayDateStr) {
    try {
        const announcementsChannel = guild.channels.cache.find(channel => 
            channel.id === flairAnnouncementChannelId 
        );
        
        if (announcementsChannel) {
            await announcementsChannel.send(
                flairAnnouncement.replace('<roleName>', roleName)
                    .replace('<member>', `<@${member.id}>`)
                    .replace('<date>', yesterdayDateStr)
            );
        }
    } catch (error) {
        console.error('Error sending role announcement:', error);
    }
}

async function checkFirstOrLastYesterday(serverId, userId, yesterdayDateStr) {
    try {
        const dayDoc = await db.collection('servers')
            .doc(serverId)
            .collection('days')
            .doc(yesterdayDateStr)
            .get();

        if (!dayDoc.exists) return false;

        const dayData = dayDoc.data();
        
        if (dayData.lastMessages) {
            if (dayData.lastMessages.last?.userId === userId) {
                return true;
            }
        }

        if (dayData.messages?.length > 0 && dayData.messages[0]?.userId === userId) {
            return true;
        }

        return false;
    } catch (error) {
        console.error(`Error checking first/last status for user ${userId}:`, error);
        return false;
    }
}

async function updateUserRoles(guild, userId, score, yesterdayDateStr) {
    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            console.log(`❌ Could not find member ${userId} in guild`);
            return;
        }

        // Check if they got first/last yesterday
        const gotFirstOrLast = await checkFirstOrLastYesterday(guild.id, userId, yesterdayDateStr);

        // Check First/Last role
        if (gotFirstOrLast && !member.roles.cache.has(ROLES.FIRST_LAST.id)) {
            try {
                await member.roles.add(ROLES.FIRST_LAST.id);
                console.log(`✅ Added First/Last role to ${member.user.username}`);
                await announceRole(guild, member, ROLES.FIRST_LAST.name, yesterdayDateStr);
                await logFlairAchievementToSheet(member.displayName, ROLES.FIRST_LAST.name, yesterdayDateStr);
            } catch (error) {
                console.error(`❌ Error adding First/Last role: ${error.message}`);
            }
        }

        // Only proceed with point-based roles if they have the First/Last role
        if (!member.roles.cache.has(ROLES.FIRST_LAST.id)) {
            console.log(`⚠️ ${member.user.username} doesn't have First/Last role - skipping point-based roles`);
            return;
        }

        // Check all point-based roles in ascending order
        const pointRoles = Object.entries(ROLES)
            .filter(([key]) => key !== 'FIRST_LAST')
            .sort((a, b) => a[1].points - b[1].points); // Sort by ascending points

        for (const [roleName, roleData] of pointRoles) {
            if (score >= roleData.points) {
                if (!member.roles.cache.has(roleData.id)) {
                    try {
                        await member.roles.add(roleData.id);
                        console.log(`✅ Added ${roleName} role to ${member.user.username}`);
                        await announceRole(guild, member, roleData.name, yesterdayDateStr);
                        await logFlairAchievementToSheet(member.displayName, roleData.name, yesterdayDateStr);
                    } catch (error) {
                        console.error(`❌ Error adding ${roleName} role: ${error.message}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error updating roles for user ${userId}:`, error);
    }
}

async function updateAllUserRoles(guild, serverId, yesterdayDateStr) {
    console.log('\n🎭 Starting role updates for all users...');
    
    try {
        const usersSnapshot = await db.collection('servers').doc(serverId).collection('users').get();
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const score = userData.score || 0;

            await updateUserRoles(guild, userDoc.id, score, yesterdayDateStr);
        }
        
        console.log('✅ Completed role updates for all users');
    } catch (error) {
        console.error('❌ Error updating roles:', error);
    }
}

async function logFlairAchievementToSheet(user, flairName, dateStr) {
    try {
        const sheetName = 'Flair Achievements';
        // Read all rows to check if this user/flair combo already exists
        const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:C`,
        });
        const rows = getRes.data.values || [];
        const alreadyLogged = rows.some(row => row[0] === user && row[1] === flairName);
        if (alreadyLogged) return;
        // Append new row
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:C`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[user, flairName, dateStr]]
            }
        });
        console.log(`Logged flair achievement: ${user} - ${flairName} on ${dateStr}`);
    } catch (error) {
        console.error('Error logging flair achievement to sheet:', error);
    }
}

module.exports = {
    updateAllUserRoles,
    updateUserRoles
};