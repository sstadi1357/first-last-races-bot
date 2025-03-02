// formatHistoryToSheets.js
const db = require('../firebase');
const sheets = require('../sheets');
const { format, parseISO, isValid } = require('date-fns');
const { shouldBeGray } = require('../config/holidayDates');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { generateUserFormatRules, addNewUserToSheet, fetchUsersFromSheet } = require('../utils/userFormatting');

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
    console.log('Analyzing historical data to determine maximum positions...');
    
    let maxPositions = 0;
    const daysRef = db.collection('servers').doc(SERVER_ID).collection('days');
    const daysSnapshot = await daysRef.get();
    
    for (const dayDoc of daysSnapshot.docs) {
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
            if (monthNames.some(month => sheetTitle.startsWith(month)) && sheet.conditionalFormats) {
                deleteRequests.push({
                    deleteConditionalFormatRule: {
                        sheetId: sheet.properties.sheetId,
                        index: 0
                    }
                });
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
            
            if (monthNames.some(month => sheetTitle.startsWith(month))) {
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
if (!SPREADSHEET_ID) {
    console.error('No spreadsheet ID configured in mainConfig.js');
}
async function formatMessageHistory() {
    try {
        if (!SPREADSHEET_ID) {
            console.error('No spreadsheet ID available. Skipping sheet updates.');
            return;
        }
        const { headers, maxPositions } = await getMaxPositionsAndCreateHeaders();
        
        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
        const currentYear = now.getFullYear();
        const currentMonthName = getMonthName(currentMonth);
        const currentSheetName = `${currentMonthName} ${currentYear}`;
        
        console.log(`Processing only the current month: ${currentSheetName}`);
        
        // Get all days collection
        const daysRef = db.collection('servers').doc(SERVER_ID).collection('days');
        const daysSnapshot = await daysRef.get();
        
        const monthlyData = new Map();
        monthlyData.set(currentSheetName, new Map());
        
        // Current month prefix (e.g., "02-" for February)
        const monthPrefix = String(currentMonth).padStart(2, '0') + "-";
        console.log(`Looking for documents with prefix: ${monthPrefix}`);
        
        let daysProcessed = 0;
        
        for (const dayDoc of daysSnapshot.docs) {
            const dayData = dayDoc.data();
            const dateStr = dayDoc.id; // Format: MM-DD-YYYY
            
            // Skip if not current month (by checking if it starts with the month prefix)
            if (!dateStr.startsWith(monthPrefix)) {
                continue;
            }
            
            daysProcessed++;
            const sheetName = getSheetName(dateStr);
            
            if (!dayData.messages?.length) {
                console.log(`No messages found for ${dateStr}`);
                continue;
            }

            const sortedMessages = dayData.messages.sort((a, b) => {
                const dateA = parseTimestamp(a.timestamp);
                const dateB = parseTimestamp(b.timestamp);
                return (dateA && dateB) ? dateA - dateB : 0;
            });

            // Process first message time
            let startTime = '';
            if (sortedMessages.length > 0) {
                const firstDate = parseTimestamp(sortedMessages[0].timestamp);
                if (firstDate) {
                    startTime = format(firstDate, 'HH:mm:ss');
                }
            }

            const positions = Array(maxPositions).fill('NONE');
            sortedMessages.forEach((msg, idx) => {
                positions[idx] = msg.username;
            });

            // Process last messages
            let secondLast = 'NONE';
            let last = 'NONE';
            let endTime = '';

            if (dayData.lastMessages) {
                if (dayData.lastMessages.last) {
                    last = dayData.lastMessages.last.username;
                    const lastDate = parseTimestamp(dayData.lastMessages.last.timestamp);
                    if (lastDate) {
                        endTime = format(lastDate, 'HH:mm:ss');
                    }
                }
                if (dayData.lastMessages.secondLast) {
                    secondLast = dayData.lastMessages.secondLast.username;
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

            monthlyData.get(currentSheetName).set(dateStr, newRow);
        }

        console.log(`Processed ${daysProcessed} days for the current month`);
        
        // Process current month data
        const [sheetName, monthData] = Array.from(monthlyData.entries())[0];
        
        if (monthData.size === 0) {
            console.log(`No data found for ${sheetName}, skipping sheet creation/update`);
            return;
        }
        
        console.log(`Processing sheet: ${sheetName} with ${monthData.size} days of data`);
        
        const { exists, data: existingData, sheetId } = await getOrCreateSheet(sheetName);
        
        // If new sheet or headers need to be updated
        if (!exists || !existingData.length || !arraysEqual(existingData[0], headers)) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [headers]
                }
            });
            await applyHeaderFormatting(sheetId);      
        }
       
        
        const sortedDates = Array.from(monthData.keys()).sort();
        const valueUpdates = [];
        const formatRequests = [];
        let currentRow = 2;

        const usernamesInNewRows = new Set();

        for (const dateStr of sortedDates) {
            const newRow = monthData.get(dateStr);
            const formattedDate = newRow[0];

            valueUpdates.push({
                range: `${sheetName}!A${currentRow}`,
                values: [newRow]
            });

            // Collect usernames from this specific row
            newRow.slice(2, -2).forEach(username => {
                if (username !== 'NONE') {
                    usernamesInNewRows.add(username);
                }
            });

            // Check if the date should be gray (with proper date formatting)
            try {
                const currentYear = new Date().getFullYear();
                const [month, day] = formattedDate.split('/');
                const dateForChecking = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                
                const shouldBeGrayBackground = shouldBeGray(dateForChecking);
                
                if (shouldBeGrayBackground) {
                    formatRequests.push({
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: currentRow - 1,
                                endRowIndex: currentRow,
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
            currentRow++;
        }

        if (valueUpdates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: valueUpdates
                }
            });
        }

        if (formatRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: formatRequests
                }
            });
        }

        // Check for users in new rows without background color rules
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true
        });
        
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        const existingRules = sheet.conditionalFormats.filter(
            rule => rule.booleanRule && 
            rule.booleanRule.condition.type === "TEXT_CONTAINS"
        );

        const existingUsernames = existingRules.map(rule => 
            rule.booleanRule.condition.values[0].userEnteredValue
        );

        // Identify usernames without rules from the new rows
        const missingUsernameRules = [...usernamesInNewRows].filter(
            username => !existingUsernames.includes(username)
        );

        // If there are usernames without rules, add them
        if (missingUsernameRules.length > 0) {
            console.log('Usernames without background color rules:', missingUsernameRules);
            
            // Use the addNewUserToSheet function from userFormatting
            
            for (const username of missingUsernameRules) {
                await addNewUserToSheet(username);
            }

            // Immediately add conditional formatting rules for new users
            
        }
        await applyConditionalFormatting({ headers });
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

        console.log('Current month sheet updated successfully');
    } catch (error) {
        console.error('Error formatting message history:', error);
        throw error;
    }
}

function arraysEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
}

module.exports = { formatMessageHistory };