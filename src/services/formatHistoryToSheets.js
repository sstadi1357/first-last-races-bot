// formatHistoryToSheets.js
const db = require('../firebase');
const sheets = require('../sheets');
const { format, parse, parseISO, isValid } = require('date-fns');
const { shouldBeGray } = require('../config/greyDates');

// Configure the spreadsheet details
const SPREADSHEET_ID = '1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow';
const SERVER_ID = '1300198974988357732';

// Cell formatting constants
const GRAY_BACKGROUND = {
    backgroundColor: {
        red: 0.8,
        green: 0.8,
        blue: 0.8
    }
};

// Header format with exact black background
const HEADER_FORMAT = {
  backgroundColor: {
      red: 1,
      green: 1,
      blue: 1
  },
  textFormat: {
      foregroundColor: {
          red: 0,
          green: 0,
          blue: 0
      },
      bold: true
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
    const [month, day, year] = dateStr.split('-');
    return `${getMonthName(parseInt(month))} ${year}`;
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

async function applyHeaderFormatting(sheetId) {
  try {
      const request = {
          spreadsheetId: SPREADSHEET_ID,
          resource: {
              requests: [
                  {
                      repeatCell: {
                          range: {
                              sheetId: sheetId,
                              startRowIndex: 0,
                              endRowIndex: 1
                          },
                          cell: {
                              userEnteredFormat: {
                                  backgroundColor: {
                                      red: 1.0,
                                      green: 1.0,
                                      blue: 1.0
                                  },
                                  horizontalAlignment: "CENTER",
                                  textFormat: {
                                      foregroundColor: {
                                          red: 0.0,
                                          green: 0.0,
                                          blue: 0.0
                                      },
                                      fontSize: 12,
                                      bold: true
                                  }
                              }
                          },
                          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                      }
                  },
                  {
                      updateSheetProperties: {
                          properties: {
                              sheetId: sheetId,
                              gridProperties: {
                                  frozenRowCount: 1
                              }
                          },
                          fields: "gridProperties.frozenRowCount"
                      }
                  }
              ]
          }
      };

      await sheets.spreadsheets.batchUpdate(request);
  } catch (error) {
      console.error('Error applying header formatting:', error);
      throw error;
  }
}

async function formatMessageHistory() {
    try {
        const { headers, maxPositions } = await getMaxPositionsAndCreateHeaders();
        const daysRef = db.collection('servers').doc(SERVER_ID).collection('days');
        const daysSnapshot = await daysRef.get();
        const monthlyData = new Map();
        
        for (const dayDoc of daysSnapshot.docs) {
            const dayData = dayDoc.data();
            const dateStr = dayDoc.id; // Format: MM-DD-YYYY
            const sheetName = getSheetName(dateStr);
            
            if (!monthlyData.has(sheetName)) {
                monthlyData.set(sheetName, new Map());
            }
            
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

            const [month, day, year] = dateStr.split('-');
            const formattedDate = `${year}-${month}-${day}`;

            const newRow = [
                formattedDate,
                startTime,
                ...positions,
                secondLast,
                last,
                endTime
            ];

            monthlyData.get(sheetName).set(dateStr, newRow);
        }

        // Process each month's data
        for (const [sheetName, monthData] of monthlyData) {
            console.log(`Processing sheet: ${sheetName}`);
            
            const { exists, data: existingData, sheetId } = await getOrCreateSheet(sheetName);
            
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

            for (const dateStr of sortedDates) {
                const newRow = monthData.get(dateStr);
                const formattedDate = newRow[0];

                valueUpdates.push({
                    range: `${sheetName}!A${currentRow}`,
                    values: [newRow]
                });

                if (shouldBeGray(formattedDate)) {
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
        }

        console.log('All monthly sheets updated successfully');
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