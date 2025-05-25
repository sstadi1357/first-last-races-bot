// formatHistoryToSheets.js
const db = require('../firebase');
const sheets = require('../sheets');
const { format, parseISO, isValid } = require('date-fns');
const { shouldBeGray } = require('../config/holidayDates');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { generateUserFormatRules, addNewUserToSheet, fetchUsersFromSheet } = require('../utils/userFormatting');
const { updateCumulativeSheet } = require('../functions/sheetCumulative');
const { logLeaderboardPointsToSheet } = require('./pointsToSheet');

// Add after the imports at the top
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return [r, g, b];
}

async function applyHeaderFormatting(sheetId) {
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    repeatCell: {
                        range: {
                            sheetId: sheetId,
                            startRowIndex: 0,
                            endRowIndex: 1
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 1, green: 1, blue: 1 },
                                textFormat: { bold: true },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                    }
                }]
            }
        });
    } catch (error) {
        console.error('Error applying header formatting:', error);
        throw error;
    }
}
// Configure the spreadsheet details
const SPREADSHEET_ID = spreadsheetId;
const SERVER_ID = serverId;

// Cell formatting constants
const GRAY_BACKGROUND = {
    backgroundColor: {
        red: 0.8,
        green: 0.8,
        blue: 0.8
    }
};

// Function to safely parse timestamp
function parseTimestamp(timestamp) {
    try {
        let date;
        
        if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else if (typeof timestamp === 'string') {
            if (timestamp.includes('T')) {
                // Try parsing as ISO string
                date = parseISO(timestamp);
            } else {
                // Try parsing as regular date string
                date = new Date(timestamp);
            }
        }

        return isValid(date) ? date : null;
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return null;
    }
}

function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
}

function getSheetName(dateStr) {
    const [month,, year] = dateStr.split('-');
    return `${getMonthName(parseInt(month))}_${year}`.replace(/\s+/g, '_');
}
async function getOrCreateSheet(sheetName) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        
        const existingSheet = spreadsheet.data.sheets.find(
            sheet => sheet.properties.title === sheetName
        );

        if (!existingSheet) {
            console.log(`Creating new sheet: ${sheetName}`);
            const response = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });

            const newSheetId = response.data.replies[0].addSheet.properties.sheetId;
            return { exists: false, data: [], sheetId: newSheetId };
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`
        });

        return { 
            exists: true, 
            data: response.data.values || [],
            sheetId: existingSheet.properties.sheetId
        };
    } catch (error) {
        console.error('Error getting/creating sheet:', error);
        throw error;
    }
}

async function getMaxPositionsAndCreateHeaders() {
    console.log('Analyzing current month data to determine maximum positions...');
    
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = now.getFullYear();
    
    // Format month to 2 digits for filtering (e.g., "02-" for February)
    const monthPrefix = String(currentMonth).padStart(2, '0') + "-";
    
    console.log(`Looking for documents with prefix: ${monthPrefix} for year ${currentYear}`);
    
    let maxPositions = 0;
    const daysRef = db.collection('servers').doc(SERVER_ID).collection('days');
    const daysSnapshot = await daysRef.get();
    
    for (const dayDoc of daysSnapshot.docs) {
        const dateStr = dayDoc.id; // Format: MM-DD-YYYY
        
        // Skip if not current month
        if (!dateStr.startsWith(monthPrefix)) {
            continue;
        }
        
        // Extract year from document ID and compare with current year
        const docYear = dateStr.split('-')[2];
        if (docYear !== String(currentYear)) {
            continue;
        }
        
        const dayData = dayDoc.data();
        if (dayData.messages && dayData.messages.length > maxPositions) {
            maxPositions = dayData.messages.length;
        }
    }

    const headers = ['Date', 'Start Time'];
    
    for (let i = 1; i <= maxPositions; i++) {
        let positionHeader;
        if (i === 1) positionHeader = '1st';
        else if (i === 2) positionHeader = '2nd';
        else if (i === 3) positionHeader = '3rd';
        else positionHeader = `${i}th`;
        headers.push(positionHeader);
    }
    
    headers.push('2nd-Last', 'Last', 'End Time');
    return { headers, maxPositions };
}

async function applyConditionalFormatting({ headers }) {
    try {
        console.log('Applying conditional formatting to all sheets...');
        
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true
        });
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // First, delete all existing rules in one batch
        const deleteRequests = [];
        for (const sheet of spreadsheet.data.sheets) {
            const sheetTitle = sheet.properties.title;
            // Update this condition to include the Cumulative Chart sheet
            if ((monthNames.some(month => sheetTitle.startsWith(month)) || sheetTitle === "Cumulative Chart") && sheet.conditionalFormats) {
                // Delete rules in reverse order to avoid index shifting problems
                for (let i = (sheet.conditionalFormats?.length || 0) - 1; i >= 0; i--) {
                    deleteRequests.push({
                        deleteConditionalFormatRule: {
                            sheetId: sheet.properties.sheetId,
                            index: i
                        }
                    });
                }
            }
        }

        if (deleteRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { requests: deleteRequests }
            });
        }

        // Then add all new rules in another batch
        const addRequests = [];
        for (const sheet of spreadsheet.data.sheets) {
            const sheetId = sheet.properties.sheetId;
            const sheetTitle = sheet.properties.title;
            
            // Also update this condition to include the Cumulative Chart sheet
            if (monthNames.some(month => sheetTitle.startsWith(month)) || sheetTitle === "Cumulative Chart") {
                // Add time-based rules
                addRequests.push(
                    {
                        addConditionalFormatRule: {
                            rule: {
                                ranges: [{
                                    sheetId: sheetId,
                                    startRowIndex: 1,
                                    startColumnIndex: 1,
                                    endColumnIndex: 2
                                }],
                                gradientRule: {
                                    minpoint: { color: { red: 0.15, green: 0.73, blue: 0.37 }, type: "NUMBER", value: "0" },
                                    midpoint: { color: { red: 0.87, green: 0.84, blue: 0.33 }, type: "NUMBER", value: "0.25" },
                                    maxpoint: { color: { red: 0.87, green: 0.36, blue: 0.34 }, type: "NUMBER", value: "0.33" }
                                }
                            },
                            index: 0
                        }
                    },
                    {
                        addConditionalFormatRule: {
                            rule: {
                                ranges: [{
                                    sheetId: sheetId,
                                    startRowIndex: 1,
                                    startColumnIndex: 2,
                                    endColumnIndex: 25
                                }],
                                gradientRule: {
                                    minpoint: { color: { red: 0.87, green: 0.36, blue: 0.34 }, type: "NUMBER", value: "0.75" },
                                    midpoint: { color: { red: 0.87, green: 0.84, blue: 0.33 }, type: "NUMBER", value: "0.95" },
                                    maxpoint: { color: { red: 0.15, green: 0.73, blue: 0.37 }, type: "NUMBER", value: "1" }
                                }
                            },
                            index: 1
                        }
                    }
                );
                
                // Add user-specific rules
                const userRules = await generateUserFormatRules(sheetId);
                addRequests.push(...userRules);
            }
        }

        if (addRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { requests: addRequests }
            });
        }
        
        console.log('Conditional formatting applied successfully to all sheets');
    } catch (error) {
        console.error('Error applying conditional formatting:', error);
        throw error;
    }
}
async function formatMessageHistory(targetMonth, targetYear) {
    try {
        if (!SPREADSHEET_ID) {
            console.error('No spreadsheet ID available. Skipping sheet updates.');
            return;
        }
        
        // Get current date for defaults
        const now = new Date();
        
        // Use provided values or defaults
        const monthToProcess = targetMonth !== undefined ? targetMonth : now.getMonth() + 1; // JavaScript months are 0-indexed
        const yearToProcess = targetYear !== undefined ? targetYear : now.getFullYear();
        
        const monthName = getMonthName(monthToProcess);
        const sheetName = `${monthName} ${yearToProcess}`;
        
        console.log(`Processing specified month: ${sheetName}`);
        
        // Calculate max positions dynamically for the target month/year
        console.log(`Analyzing ${monthName} ${yearToProcess} data to determine maximum positions...`);
        
        const monthPrefix = String(monthToProcess).padStart(2, '0') + "-";
        const targetYearStr = String(yearToProcess);
        
        const daysRef = db.collection('servers').doc(SERVER_ID).collection('days');
        const daysSnapshot = await daysRef.get();
        
        // Find max positions specifically for the target month/year
        let maxPositions = 0;
        
        for (const dayDoc of daysSnapshot.docs) {
            const dateStr = dayDoc.id; // Format: MM-DD-YYYY
            
            if (!dateStr.startsWith(monthPrefix)) {
                continue;
            }
            
            // Extract year from document ID and compare with target year
            const docYear = dateStr.split('-')[2];
            if (docYear !== targetYearStr) {
                continue;
            }
            
            const dayData = dayDoc.data();
            if (dayData.messages && dayData.messages.length > maxPositions) {
                maxPositions = dayData.messages.length;
            }
        }
        
        console.log(`Maximum positions for ${monthName} ${yearToProcess}: ${maxPositions}`);
        
        // Create headers based on the max positions
        const headers = ['Date', 'Start Time'];
        
        for (let i = 1; i <= maxPositions; i++) {
            let positionHeader;
            if (i === 1) positionHeader = '1st';
            else if (i === 2) positionHeader = '2nd';
            else if (i === 3) positionHeader = '3rd';
            else positionHeader = `${i}th`;
            headers.push(positionHeader);
        }
        
        headers.push('2nd-Last', 'Last', 'End Time');
        
        // Calculate row offset for cumulative chart (still needed for the original updateCumulativeSheet call)
        console.log("Calculating row offset for Cumulative Chart...");
        let priorDateCount = 0;
        
        // Current month and year (for cumulative chart)
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // Count all documents that don't match current month/year
        for (const dayDoc of daysSnapshot.docs) {
            const dateStr = dayDoc.id; // Format: MM-DD-YYYY
            const [docMonth, docDay, docYear] = dateStr.split('-');
            
            // Skip if this is the current month and year
            if (docMonth === String(currentMonth).padStart(2, '0') && docYear === String(currentYear)) {
                continue;
            }
            
            // Only count days with messages
            const dayData = dayDoc.data();
            if (dayData.messages && dayData.messages.length > 0) {
                priorDateCount++;
            }
        }
        
        // Calculate starting row (header row + all previous dates + 1)
        const cumulativeStartRow = priorDateCount + 2;
        console.log(`Found ${priorDateCount} prior dates. Cumulative chart will start at row ${cumulativeStartRow}`);
        
        // Process the data for the target month
        console.log(`Looking for documents with prefix: ${monthPrefix} for year ${yearToProcess}`);
        
        // Create an array to store all the rows (including header)
        const sheetData = [headers];
        
        // Process and collect all day data
        let daysWithMessages = [];
        
        for (const dayDoc of daysSnapshot.docs) {
            const dateStr = dayDoc.id; // Format: MM-DD-YYYY
            
            // Skip if not target month/year
            if (!dateStr.startsWith(monthPrefix)) {
                continue;
            }
            
            // Check year
            const docYear = dateStr.split('-')[2];
            if (docYear !== targetYearStr) {
                continue;
            }
            
            const dayData = dayDoc.data();
            if (!dayData.messages?.length) {
                console.log(`No messages found for ${dateStr}`);
                continue;
            }
            
            daysWithMessages.push({
                dateStr: dateStr,
                data: dayData
            });
        }
        
        // Sort days chronologically
        daysWithMessages.sort((a, b) => {
            const [aMonth, aDay, aYear] = a.dateStr.split('-').map(Number);
            const [bMonth, bDay, bYear] = b.dateStr.split('-').map(Number);
            
            if (aYear !== bYear) return aYear - bYear;
            if (aMonth !== bMonth) return aMonth - bMonth;
            return aDay - bDay;
        });
        
        // Build sheet rows
        for (const { dateStr, data } of daysWithMessages) {
            const sortedMessages = data.messages.sort((a, b) => {
                const dateA = parseTimestamp(a.timestamp);
                const dateB = parseTimestamp(b.timestamp);
                return (dateA && dateB) ? dateA - dateB : 0;
            });
            
            // Process first message time
            let startTime = '';
            if (sortedMessages.length > 0) {
                const firstDate = parseTimestamp(sortedMessages[0].timestamp);
                if (firstDate) {
                    startTime = format(firstDate, 'h:mm:ss a');
                }
            }
            
            const positions = Array(maxPositions).fill('NONE');
            sortedMessages.forEach((msg, idx) => {
                if (idx < maxPositions) {
                    positions[idx] = msg.username;
                }
            });
            
            // Process last messages
            let secondLast = 'NONE';
            let last = 'NONE';
            let endTime = '';
            
            if (data.lastMessages) {
                if (data.lastMessages.last) {
                    last = data.lastMessages.last.username;
                    const lastDate = parseTimestamp(data.lastMessages.last.timestamp);
                    if (lastDate) {
                        endTime = format(lastDate, 'h:mm:ss a');
                    }
                }
                if (data.lastMessages.secondLast) {
                    secondLast = data.lastMessages.secondLast.username;
                }
            }
            
            // Change date format from MM-DD-YYYY to MM/DD/YYYY for consistency with sheet formatting
            const [month, day, year] = dateStr.split('-');
            const formattedDate = `${month}/${day}`;
            
            const newRow = [
                formattedDate,
                startTime,
                ...positions,
                secondLast,
                last,
                endTime
            ];
            
            sheetData.push(newRow);
        }
        
        console.log(`Processed ${daysWithMessages.length} days for ${sheetName}`);
        
        // Get or create the sheet
        const { exists, sheetId } = await getOrCreateSheet(sheetName);
        const sheetTitle = exists ? sheetName : sheetName.replace(/\s+/g, '_');
        
        // CRITICAL: Clear the entire sheet first before writing new data
        // This ensures we start fresh and don't have issues with leftover data
        try {
            console.log(`Clearing all data from sheet: ${sheetTitle}`);
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetTitle}!A1:Z1000` // Clear a large range to ensure all data is removed
            });
        } catch (error) {
            console.error(`Error clearing sheet: ${error.message}`);
            // Continue anyway - the update will still work
        }
        
        // Write all data at once
        if (sheetData.length > 1) { // Only if we have data (header + at least one row)
            console.log(`Writing ${sheetData.length} rows to sheet ${sheetTitle}`);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetTitle}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: sheetData
                }
            });
            
            // Apply header formatting
            await applyHeaderFormatting(sheetId);
            
            // Apply gray background for holiday dates
            const formatRequests = [];
            
            // Start from row 2 (after header) for checking dates
            for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex++) {
                const formattedDate = sheetData[rowIndex][0]; // First column is the date
                try {
                    const [month, day] = formattedDate.split('/');
                    const dateForChecking = `${yearToProcess}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    
                    const shouldBeGrayBackground = shouldBeGray(dateForChecking);
                    
                    if (shouldBeGrayBackground) {
                        formatRequests.push({
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: rowIndex,
                                    endRowIndex: rowIndex + 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: GRAY_BACKGROUND
                                },
                                fields: 'userEnteredFormat.backgroundColor'
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Error checking if date should be gray: ${error.message}`);
                }
            }
            
            if (formatRequests.length > 0) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: formatRequests
                    }
                });
            }
            
            // Collect all unique usernames from the data
            const allUsernames = new Set();
            
            for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex++) {
                const row = sheetData[rowIndex];
                // Check all username columns (everything after startTime and before 2nd-Last)
                for (let colIndex = 2; colIndex < row.length - 2; colIndex++) {
                    const username = row[colIndex];
                    if (username !== 'NONE') {
                        allUsernames.add(username);
                    }
                }
            }
            
            // Add any missing username format rules
            if (allUsernames.size > 0) {
                console.log(`Found ${allUsernames.size} unique usernames in data`);
                
                // Fetch existing users from sheet
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: 'Users!A:B'
                });
                const existingUsers = new Set((response.data.values || []).slice(1).map(row => row[0]));
                
                // Only add users that don't exist in the sheet
                const newUsers = [...allUsernames].filter(username => !existingUsers.has(username));
                
                if (newUsers.length > 0) {
                    console.log(`Adding ${newUsers.length} new users to sheet`);
                    for (const username of newUsers) {
                        await addNewUserToSheet(username);
                    }
                } else {
                    console.log('No new users to add');
                }
            }
            
            // Auto-resize columns
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        autoResizeDimensions: {
                            dimensions: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: 0,
                                endIndex: headers.length
                            }
                        }
                    }]
                }
            });
            
            // Apply conditional formatting
            await applyConditionalFormatting({ headers });
        } else {
            console.log(`No data found for ${sheetName}, sheet was cleared but not populated`);
        }
        
        // Only update cumulative chart if working with current month
        if (monthToProcess === currentMonth && yearToProcess === currentYear) {
            console.log(`Updating Cumulative Chart with ${currentMonth}/${currentYear} data starting at row ${cumulativeStartRow}`);
            await updateCumulativeSheet(currentMonth, currentYear, cumulativeStartRow);
        } else {
            console.log(`Skipping Cumulative Chart update because we're processing a non-current month (${monthToProcess}/${yearToProcess})`);
        }

        // Check if yesterday's date is already the last row in the Cumulative Points sheet
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getMonth() + 1}/${yesterday.getDate()}`;
        const cumulativePointsSheetName = 'Cumulative Points';
        try {
            const getRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${cumulativePointsSheetName}!A:A`,
            });
            const rows = getRes.data.values || [];
            const lastRow = rows.length > 1 ? rows[rows.length - 1][0] : null;
            if (lastRow !== yesterdayStr) {
                await logLeaderboardPointsToSheet(SERVER_ID);
            } else {
                console.log(`Cumulative Points sheet already has a row for ${yesterdayStr}, skipping logLeaderboardPointsToSheet.`);
            }
        } catch (err) {
            console.error('Error checking Cumulative Points sheet for yesterday:', err);
            // Fallback: still try to log
            await logLeaderboardPointsToSheet(SERVER_ID);
        }
    
        console.log(`${sheetName} sheet processed successfully`);
    } catch (error) {
        console.error('Error formatting message history:', error);
        throw error;
    }
}
module.exports = { formatMessageHistory, getMaxPositionsAndCreateHeaders};