const db = require('../firebase');
const sheets = require('../sheets');
const { spreadsheetId } = require('../config/mainConfig');

/**
 * Log leaderboard points to the "Cumulative Points" sheet for users with >= 20 points.
 * Adds new users as columns if needed. Logs yesterday's date as the row label.
 * @param {string} serverId - The ID of the server to get leaderboard data from
 */
async function logLeaderboardPointsToSheet(serverId) {
    try {
        // Get leaderboard
        const leaderboardDoc = await db.collection('servers').doc(serverId).collection('leaderboard').doc('current').get();
        if (!leaderboardDoc.exists) return;
        const rankings = leaderboardDoc.data().rankings || [];
        const filtered = rankings.filter(u => u.score >= 20);
        if (filtered.length === 0) return;

        const sheetName = 'Cumulative Points';

        // Get header row (top row)
        const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!1:1`,
        });
        let header = getRes.data.values[0]; // [Date, user1, user2, ...]
        if (!header) header = ['Date'];

        // Get all date rows (excluding header)
        const dateRowsRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A2:A`,
        });
        const dateRows = (dateRowsRes.data.values || []).map(row => row[0]); // e.g. ['1/20', '1/21', ...]

        // Add new users as columns if needed
        let newUsers = [];
        for (const user of filtered) {
            if (!header.includes(user.username)) {
                header.push(user.username);
                newUsers.push(user.username);
            }
        }
        // If new users, update the header row
        if (newUsers.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!1:1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [header]
                }
            });

            // Backfill historic points for new users
            for (const username of newUsers) {
                // Find userId for this username from current leaderboard
                const userObj = filtered.find(u => u.username === username);
                if (!userObj) continue;
                const userId = userObj.userId;
                // For each date row, look up the user's score in history-leaderboards
                for (let i = 0; i < dateRows.length; i++) {
                    const dateStr = dateRows[i]; // e.g. '1/20'
                    // Convert MM/DD to MM-DD-YYYY (guess year from today or previous row if needed)
                    // We'll try both MM-DD-YYYY and MM/DD/YYYY for robustness
                    // Try to find the Firestore doc for this date
                    let foundDoc = null;
                    let firestoreDate = null;
                    // Try to get the year from the next column (if present)
                    // We'll try all years from 2022 to current year
                    const currentYear = new Date().getFullYear();
                    for (let year = 2022; year <= currentYear; year++) {
                        const [month, day] = dateStr.split('/');
                        const tryDate = `${month.padStart(2, '0')}-${day.padStart(2, '0')}-${year}`;
                        const doc = await db.collection('servers').doc(serverId).collection('history-leaderboards').doc(tryDate).get();
                        if (doc.exists) {
                            foundDoc = doc;
                            firestoreDate = tryDate;
                            break;
                        }
                    }
                    if (!foundDoc) continue;
                    const rankings = foundDoc.data().rankings || [];
                    const userEntry = rankings.find(u => u.userId === userId);
                    // Get the column index for this user
                    const colIndex = header.indexOf(username);
                    if (colIndex === -1) continue;
                    // Update the cell if not already filled
                    // Get the full row for this date
                    const rowRes = await sheets.spreadsheets.values.get({
                        spreadsheetId,
                        range: `${sheetName}!A${i + 2}:${String.fromCharCode(65 + header.length - 1)}${i + 2}`
                    });
                    let row = rowRes.data.values && rowRes.data.values[0] ? rowRes.data.values[0] : Array(header.length).fill('');
                    // If the cell is empty or 0, fill it
                    if (!row[colIndex] || row[colIndex] === '0') {
                        row[colIndex] = userEntry ? userEntry.score : 0;
                        // Write the updated row back
                        await sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `${sheetName}!A${i + 2}:${String.fromCharCode(65 + header.length - 1)}${i + 2}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [row]
                            }
                        });
                    } else if (row[colIndex] === undefined) {
                        // If the cell is undefined (row is shorter than header), fill with 0
                        row[colIndex] = 0;
                        await sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `${sheetName}!A${i + 2}:${String.fromCharCode(65 + header.length - 1)}${i + 2}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [row]
                            }
                        });
                    }
                }
            }
        }

        // Prepare row: yesterday's date, then points for each user in header
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getMonth() + 1}/${yesterday.getDate()}`;
        const row = [dateStr];
        for (let i = 1; i < header.length; i++) {
            const user = filtered.find(u => u.username === header[i]);
            row.push(user ? user.score : 0);
        }

        // Append row to the bottom
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row]
            }
        });
        console.log(`Logged leaderboard points for ${dateStr} to sheet ${sheetName}`);
    } catch (error) {
        console.error('Error logging leaderboard points to sheet:', error);
    }
}

module.exports = { logLeaderboardPointsToSheet };