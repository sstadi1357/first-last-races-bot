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

/**
 * Convert column number to letter (handling beyond Z)
 * @param {number} col - Column number (1-based)
 * @returns {string} Column letter (A, B, ..., Z, AA, AB, etc.)
 */
function columnToLetter(col) {
    if (col <= 26) {
        return String.fromCharCode(64 + col); // A-Z
    } else {
        // For columns beyond Z (AA, AB, etc.)
        const firstChar = String.fromCharCode(64 + Math.floor((col - 1) / 26));
        const secondChar = String.fromCharCode(64 + ((col - 1) % 26) + 1);
        return firstChar + secondChar;
    }
}

/**
 * Log historic leaderboard rankings to the "Historic Leaderboards" sheet.
 * Adds the top 10 users from yesterday's leaderboard as a new row.
 * @param {string} serverId - The ID of the server to get leaderboard data from
 */
async function logHistoricLeaderboardsToSheet(serverId) {
    try {
        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getMonth() + 1}/${yesterday.getDate()}`;
        
        console.log(`Yesterday's date: ${yesterday.toDateString()}`);
        console.log(`Formatted date string: ${dateStr}`);
        
        const sheetName = 'Historic Leaderboards';

        // First, check if the sheet exists
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
            includeGridData: false
        });
        
        let sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            console.log(`Sheet "${sheetName}" does not exist. Creating it...`);
            // Create the sheet
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName,
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: 30
                                }
                            }
                        }
                    }]
                }
            });
            console.log(`Created sheet "${sheetName}"`);
            
            // Refresh sheet info
            const updatedSpreadsheet = await sheets.spreadsheets.get({
                spreadsheetId,
                includeGridData: false
            });
            sheet = updatedSpreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        }

        // Check if yesterday's date is already in the sheet
        const dateCheckRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:A`,
        });
        const allRows = (dateCheckRes.data.values || []).map(row => row[0]);
        // Skip the first row (header) and filter out empty dates
        // Only include rows where column A actually has a valid date value
        const dateRows = allRows.slice(1).filter(date => {
            if (!date || typeof date !== 'string') return false;
            const trimmed = date.trim();
            if (trimmed === '') return false;
            if (trimmed.startsWith('=')) return false; // Exclude formulas
            if (!trimmed.includes('/')) return false; // Must contain slash
            if (trimmed.length < 3) return false; // Must be at least "1/1"
            
            // Check if it looks like a valid date format (M/D or MM/DD)
            const parts = trimmed.split('/');
            if (parts.length !== 2) return false;
            
            const month = parseInt(parts[0]);
            const day = parseInt(parts[1]);
            
            return month >= 1 && month <= 12 && day >= 1 && day <= 31;
        });
        
        console.log(`Checking for existing date: ${dateStr}`);
        console.log(`All rows from column A:`, allRows);
        console.log(`Filtered dates in sheet (excluding header):`, dateRows);
        console.log(`Date string to find: "${dateStr}" (length: ${dateStr.length})`);
        console.log(`Number of filtered dates: ${dateRows.length}`);
        
        // Check each date individually for debugging
        for (let i = 0; i < dateRows.length; i++) {
            const existingDate = dateRows[i];
            const matches = existingDate === dateStr;
            console.log(`Filtered date ${i}: "${existingDate}" (length: ${existingDate.length}) - matches "${dateStr}"? ${matches}`);
            
            // Special debugging for the matching entry
            if (matches) {
                console.log(`*** FOUND MATCH at index ${i} ***`);
                console.log(`  - existingDate: "${existingDate}"`);
                console.log(`  - dateStr: "${dateStr}"`);
                console.log(`  - existingDate type: ${typeof existingDate}`);
                console.log(`  - dateStr type: ${typeof dateStr}`);
                console.log(`  - existingDate char codes: ${Array.from(existingDate).map(c => c.charCodeAt(0))}`);
                console.log(`  - dateStr char codes: ${Array.from(dateStr).map(c => c.charCodeAt(0))}`);
            }
        }
        
        // Also check the raw data around row 172 to see what's actually there
        console.log(`\nChecking raw data around row 172:`);
        for (let i = 170; i < 175; i++) {
            if (allRows[i]) {
                console.log(`Raw row ${i + 1}: "${allRows[i]}" (type: ${typeof allRows[i]}, length: ${allRows[i].length})`);
            } else {
                console.log(`Raw row ${i + 1}: null/undefined`);
            }
        }
        
        // Check what's at the specific position where "7/23" should be (index 170 in filtered array = row 171 in sheet)
        console.log(`\nChecking the specific position where "7/23" was found:`);
        console.log(`Filtered array index 170 should correspond to sheet row 171 (after skipping header)`);
        console.log(`Raw data at index 170: "${allRows[170]}"`);
        console.log(`Raw data at index 171: "${allRows[171]}"`);
        console.log(`Raw data at index 172: "${allRows[172]}"`);
        
        // Check for exact match first
        console.log(`Looking for exact match: "${dateStr}"`);
        console.log(`dateRows.includes("${dateStr}"): ${dateRows.includes(dateStr)}`);
        if (dateRows.includes(dateStr)) {
            console.log(`Historic Leaderboards sheet already has data for ${dateStr}, skipping.`);
            return;
        }
        
        // Also check for different date formats that might exist in the sheet
        const possibleFormats = [
            dateStr, // "7/23"
            `${dateStr}/${yesterday.getFullYear()}`, // "7/23/2024"
            `${dateStr}/${yesterday.getFullYear() - 1}`, // "7/23/2023" (in case it's from last year)
            `${dateStr}/${yesterday.getFullYear() + 1}`, // "7/23/2025" (in case it's from next year)
        ];
        
        console.log(`Checking all possible date formats:`, possibleFormats);
        
        for (const format of possibleFormats) {
            console.log(`Checking format: "${format}"`);
            if (dateRows.includes(format)) {
                console.log(`Historic Leaderboards sheet already has data for ${dateStr} (found as "${format}"), skipping.`);
                return;
            }
        }
        
        console.log(`Date ${dateStr} not found in sheet, proceeding to add new row.`);

        // Get yesterday's leaderboard from history-leaderboards collection
        const yesterdayStr = yesterday.toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).split(',')[0].split('/').join('-');
        
        const historyDoc = await db.collection('servers').doc(serverId).collection('history-leaderboards').doc(yesterdayStr).get();
        
        if (!historyDoc.exists) {
            console.log(`No historic leaderboard data found for ${yesterdayStr}`);
            return;
        }
        
        const rankings = historyDoc.data().rankings || [];
        const top10 = rankings.slice(0, 10); // Get top 10 users
        
        if (top10.length === 0) {
            console.log(`No rankings found for ${yesterdayStr}`);
            return;
        }

        // Prepare row: date + top 10 usernames
        const row = [dateStr];
        for (const user of top10) {
            row.push(user.username);
        }
        
        // Pad with empty cells if less than 10 users
        while (row.length < 11) { // 1 for date + 10 for users
            row.push('');
        }

        // Append row to the bottom
        const appendRes = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [row]
            }
        });
        
        // Get the row number where the data was appended
        const updatedRange = appendRes.data.updates.updatedRange;
        const rowNumber = parseInt(updatedRange.match(/A(\d+)/)[1]);
        
        console.log(`Logged historic leaderboard for ${dateStr} to sheet ${sheetName} at row ${rowNumber}`);
        
        // Check if we're within grid limits before adding formulas
        const maxRows = sheet.properties.gridProperties.rowCount;
        const maxCols = sheet.properties.gridProperties.columnCount;
        
        if (rowNumber > maxRows) {
            console.log(`Row ${rowNumber} exceeds sheet limit of ${maxRows}. Skipping formula addition.`);
            return;
        }
        
        if (maxCols < 30) {
            console.log(`Sheet only has ${maxCols} columns, need 30 for formulas. Skipping formula addition.`);
            return;
        }
        
        // Add the formula to columns M:AD (columns 13-30)
        const formulaRequests = [];
        for (let col = 13; col <= 30; col++) { // M=13, AD=30
            const colLetter = columnToLetter(col);
            const formula = `=IF(COUNTIF($B${rowNumber}:$K${rowNumber}, ${colLetter}$1), MATCH(${colLetter}$1, $B${rowNumber}:$K${rowNumber}, 0) + COLUMN($B${rowNumber}) - 2, "")`;
            
            formulaRequests.push({
                updateCells: {
                    range: {
                        sheetId: appendRes.data.updates.updatedSheetId,
                        startRowIndex: rowNumber - 1, // 0-indexed
                        endRowIndex: rowNumber,
                        startColumnIndex: col - 1, // 0-indexed
                        endColumnIndex: col
                    },
                    rows: [{
                        values: [{
                            userEnteredValue: {
                                formulaValue: formula
                            }
                        }]
                    }],
                    fields: 'userEnteredValue'
                }
            });
        }
        
        // Apply the formulas
        if (formulaRequests.length > 0) {
            try {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: {
                        requests: formulaRequests
                    }
                });
                console.log(`Added formulas to columns M-AD for row ${rowNumber}`);
            } catch (error) {
                console.error(`Error adding formulas to row ${rowNumber}:`, error.message);
                // Continue without formulas - the data is still written
            }
        }
        
    } catch (error) {
        console.error('Error logging historic leaderboard to sheet:', error);
    }
}

module.exports = { logLeaderboardPointsToSheet, logHistoricLeaderboardsToSheet };