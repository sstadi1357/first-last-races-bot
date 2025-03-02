// formatHistoryToSheets.js
const db = require('../firebase');
const sheets = require('../sheets');
const { format, parseISO, isValid } = require('date-fns');
const { shouldBeGray } = require('../config/holidayDates');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { generateUserFormatRules, fetchUsersFromSheet } = require('../utils/userFormatting');

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

async function applyConditionalFormatting(sheetId, { headers }) {
    try {
        // Define column indices
        const startTimeIndex = 1;  // Column B
        const endTimeRangeStart = 2;    // Column C
        const endTimeRangeEnd = 25;     // Column Z
        
        console.log('Applying conditional formatting to sheet...');
        
        // First, get existing conditional format rules to delete
        let existingRules = [];
        try {
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID,
                includeGridData: true
            });
            
            const sheet = spreadsheet.data.sheets.find(s => s.properties.sheetId === sheetId);
            if (sheet && sheet.conditionalFormats) {
                existingRules = sheet.conditionalFormats;
            }
        } catch (fetchError) {
            console.error('Error fetching existing conditional formats:', fetchError);
        }

        // First, delete existing rules in a separate batch update
        if (existingRules.length > 0) {
            const deleteRequests = existingRules.map((rule, index) => ({
                deleteConditionalFormatRule: {
                    sheetId: sheetId,
                    index: 0  // Always delete from index 0
                }
            }));

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: { requests: deleteRequests }
            });
        }

        // Then, add new rules in another batch update
        const addRequests = [
            // Start Time color scale (green to red) - earlier is better (green)
            {
                addConditionalFormatRule: {
                    rule: {
                        ranges: [{
                            sheetId: sheetId,
                            startRowIndex: 1,  // Skip header row
                            startColumnIndex: startTimeIndex,
                            endColumnIndex: startTimeIndex + 1
                        }],
                        gradientRule: {
                            minpoint: {
                                color: {
                                    red: 0.15,
                                    green: 0.73,
                                    blue: 0.37  // Green
                                },
                                type: "NUMBER",
                                value: "0"  // Midnight (earliest)
                            },
                            midpoint: {
                                color: {
                                    red: 0.87,
                                    green: 0.84,
                                    blue: 0.33  // Yellow
                                },
                                type: "NUMBER",
                                value: "0.25"  // 6:00 AM
                            },
                            maxpoint: {
                                color: {
                                    red: 0.87,
                                    green: 0.36,
                                    blue: 0.34  // Red
                                },
                                type: "NUMBER",
                                value: "0.33"  // 8:00 AM (latest)
                            }
                        }
                    },
                    index: 0
                }
            },
            
            // End Time color scale (red to green) - later is better (green)
            {
                addConditionalFormatRule: {
                    rule: {
                        ranges: [{
                            sheetId: sheetId,
                            startRowIndex: 1,  // Skip header row
                            startColumnIndex: endTimeRangeStart,
                            endColumnIndex: endTimeRangeEnd
                        }],
                        gradientRule: {
                            minpoint: {
                                color: {
                                    red: 0.87,
                                    green: 0.36,
                                    blue: 0.34  // Red
                                },
                                type: "NUMBER",
                                value: "0.75"  // 6:00 PM (earliest)
                            },
                            midpoint: {
                                color: {
                                    red: 0.87,
                                    green: 0.84,
                                    blue: 0.33  // Yellow
                                },
                                type: "NUMBER",
                                value: "0.95"  // 10:48 PM
                            },
                            maxpoint: {
                                color: {
                                    red: 0.15,
                                    green: 0.73,
                                    blue: 0.37  // Green
                                },
                                type: "NUMBER",
                                value: "1"  // Midnight (latest)
                            }
                        }
                    },
                    index: 1
                }
            }
        ];

        // Add user-specific conditional formatting rules
        const userRules = await generateUserFormatRules(sheetId);
        addRequests.push(...userRules);
        
        // Perform the add rules batch update
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: addRequests }
        });
        
        console.log('Conditional formatting applied successfully');
    } catch (error) {
        console.error('Error applying conditional formatting:', error);
        throw error;
    }
}
async function formatMessageHistory() {
    try {
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
        await applyConditionalFormatting(sheetId, { headers });
        const sortedDates = Array.from(monthData.keys()).sort();
        const valueUpdates = [];
        const formatRequests = [];
        let currentRow = 2;

        for (const dateStr of sortedDates) {
            const newRow = monthData.get(dateStr);
            const formattedDate = newRow[0];

            valueUpdates.push({
                range: `${sheetName}!A${currentRow}`,
                values: [newRow]
            });

            // Check if the date should be gray (with proper date formatting)
            try {
                // Format date string properly for shouldBeGray function
                // formattedDate is in MM/DD format, we need YYYY-MM-DD
                const currentYear = new Date().getFullYear();
                const [month, day] = formattedDate.split('/');
                const dateForChecking = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                
                console.log(`Checking date ${formattedDate} (converted to ${dateForChecking})`);
                
                const shouldBeGrayBackground = shouldBeGray(dateForChecking);
                console.log(`Date ${dateForChecking} should be gray: ${shouldBeGrayBackground}`);
                
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