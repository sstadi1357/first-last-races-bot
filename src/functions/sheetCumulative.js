const db = require('../firebase');
const sheets = require('../sheets');
const { format, parseISO, isValid } = require('date-fns');
const { shouldBeGray } = require('../config/holidayDates');
const { serverId, spreadsheetId } = require('../config/mainConfig');
const { addNewUserToSheet } = require('../utils/userFormatting');

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

async function getMaxPositionsAndCreateHeaders(targetMonth, targetYear) {
    console.log(`Analyzing ${targetMonth}/${targetYear} data to determine maximum positions...`);
    
    // Format month to 2 digits for filtering (e.g., "02-" for February)
    const monthPrefix = String(targetMonth).padStart(2, '0') + "-";
    
    console.log(`Looking for documents with prefix: ${monthPrefix} for year ${targetYear}`);
    
    let maxPositions = 0;
    const daysRef = db.collection('servers').doc(serverId).collection('days');
    const daysSnapshot = await daysRef.get();
    
    for (const dayDoc of daysSnapshot.docs) {
        const dateStr = dayDoc.id; // Format: MM-DD-YYYY
        
        // Skip if not the target month
        if (!dateStr.startsWith(monthPrefix)) {
            continue;
        }
        
        // Extract year from document ID and compare with target year
        const docYear = dateStr.split('-')[2];
        if (docYear !== String(targetYear)) {
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

async function updateCumulativeSheet(month, year, startRow) {
    try {
        if (!spreadsheetId) {
            console.error('No spreadsheet ID available. Skipping sheet updates.');
            return;
        }
        
        console.log(`Updating cumulative sheet for ${month}/${year} starting at row ${startRow}`);
        
        // Get headers and max positions for the target month
        const { headers, maxPositions: originalMaxPositions } = await getMaxPositionsAndCreateHeaders(month, year);
        
        // Check existing sheet structure first
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId
        });
        
        const existingSheet = spreadsheet.data.sheets.find(
            sheet => sheet.properties.title === 'Cumulative Chart'
        );
        
        let existingPositionCount = 0;
        let maxPositions = originalMaxPositions;
        
        if (existingSheet) {
            // Get current headers from sheet
            const headerResponse = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'Cumulative Chart!A1:Z1'
            });
            
            const existingHeaders = headerResponse.data.values ? headerResponse.data.values[0] : [];
            existingPositionCount = existingHeaders.length - 5;
            
            console.log(`Existing headers have ${existingPositionCount} positions, current max is ${maxPositions}`);
            
            // If existing sheet has more positions than current month, pad current month data
            if (existingPositionCount > maxPositions) {
                console.log(`Current month has fewer positions (${maxPositions}) than existing sheet (${existingPositionCount}). Padding current month data with NONE values.`);
                maxPositions = existingPositionCount;
            }
        }
        
        // Format month to 2 digits for filtering
        const monthPrefix = String(month).padStart(2, '0') + "-";
        console.log(`Looking for documents with prefix: ${monthPrefix}`);
        
        // Get all days collection
        const daysRef = db.collection('servers').doc(serverId).collection('days');
        const daysSnapshot = await daysRef.get();
        
        // Map to store data for the specified month
        const monthData = new Map();
        
        let daysProcessed = 0;
        
        // Process each day document
        for (const dayDoc of daysSnapshot.docs) {
            const dayData = dayDoc.data();
            const dateStr = dayDoc.id; // Format: MM-DD-YYYY
            
            // Skip if not the requested month
            if (!dateStr.startsWith(monthPrefix)) {
                continue;
            }
            
            // Extract year from document ID and compare with requested year
            const docYear = dateStr.split('-')[2];
            if (docYear !== String(year)) {
                continue;
            }
            
            daysProcessed++;
            
            if (!dayData.messages?.length) {
                console.log(`No messages found for ${dateStr}`);
                continue;
            }
            
            // Sort messages by timestamp
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
                    startTime = format(firstDate, 'h:mm:ss a');
                }
            }
            
            // Fill positions array with usernames
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
                        endTime = format(lastDate, 'h:mm:ss a');
                    }
                }
                if (dayData.lastMessages.secondLast) {
                    secondLast = dayData.lastMessages.secondLast.username;
                }
            }
            
            // Format date as MM/DD/YYYY for sheet
            const [monthStr, day, yearStr] = dateStr.split('-');
            const formattedDate = `${month}/${day}`;
            
            // Create row data
            const newRow = [
                formattedDate,
                startTime,
                ...positions,
                secondLast,
                last,
                endTime
            ];
            monthData.set(dateStr, newRow);
        }
        
        console.log(`Processed ${daysProcessed} days for ${month}/${year}`);
        
        if (monthData.size === 0) {
            console.log(`No data found for ${month}/${year}, skipping update`);
            return;
        }
        
        // Get or create the Cumulative Chart sheet
        let sheetId;
        const allFormatRequests = [];
        
        if (existingSheet) {
            sheetId = existingSheet.properties.sheetId;
            console.log('Found existing Cumulative Chart sheet');
            
            // If maxPositions is greater than existingPositionCount, update the structure
            if (maxPositions > existingPositionCount) {
                console.log(`Updating headers to accommodate ${maxPositions} positions`);
                
                // Create new headers with increased positions
                const newHeaders = ['Date', 'Start Time'];
                
                for (let i = 1; i <= maxPositions; i++) {
                    let positionHeader;
                    if (i === 1) positionHeader = '1st';
                    else if (i === 2) positionHeader = '2nd';
                    else if (i === 3) positionHeader = '3rd';
                    else positionHeader = `${i}th`;
                    newHeaders.push(positionHeader);
                }
                
                newHeaders.push('2nd-Last', 'Last', 'End Time');
                
                // Update headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: 'Cumulative Chart!A1',
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [newHeaders]
                    }
                });
                
                // Apply header formatting
                allFormatRequests.push({
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
                });
                
                // Update existing rows to match new structure
                if (startRow > 2) {
                    const dataResponse = await sheets.spreadsheets.values.get({
                        spreadsheetId,
                        range: `Cumulative Chart!A2:Z${startRow-1}`
                    });
                    
                    if (dataResponse.data.values && dataResponse.data.values.length > 0) {
                        console.log(`Updating column structure for ${dataResponse.data.values.length} existing rows`);
                        
                        const updatedRows = [];
                        let rowIndex = 2;
                        
                        dataResponse.data.values.forEach(row => {
                            if (row && row.length > 0) {
                                const date = row[0] || '';
                                const startTime = row[1] || '';
                                
                                const newPositions = Array(maxPositions).fill('NONE');
                                
                                // Copy existing positions
                                for (let i = 0; i < Math.min(existingPositionCount, row.length - 2); i++) {
                                    if (row[i + 2] !== undefined && row[i + 2] !== null) {
                                        newPositions[i] = row[i + 2];
                                    }
                                }
                                
                                // Get trailing columns
                                const secondLast = row.length > existingPositionCount + 2 ? 
                                    row[existingPositionCount + 2] : 'NONE';
                                const last = row.length > existingPositionCount + 3 ? 
                                    row[existingPositionCount + 3] : 'NONE';
                                const endTime = row.length > existingPositionCount + 4 ? 
                                    row[existingPositionCount + 4] : '';
                                
                                const updatedRow = [
                                    date,
                                    startTime,
                                    ...newPositions,
                                    secondLast, 
                                    last,
                                    endTime
                                ];
                                
                                updatedRows.push({
                                    range: `Cumulative Chart!A${rowIndex}`,
                                    values: [updatedRow]
                                });
                                
                                rowIndex++;
                            }
                        });
                        
                        if (updatedRows.length > 0) {
                            await sheets.spreadsheets.values.batchUpdate({
                                spreadsheetId,
                                resource: {
                                    valueInputOption: 'USER_ENTERED',
                                    data: updatedRows
                                }
                            });
                            console.log(`Updated ${updatedRows.length} existing rows to new column structure`);
                        }
                    }
                }
            }
        } else {
            // Create new sheet if it doesn't exist
            const response = await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: 'Cumulative Chart',
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: headers.length
                                }
                            }
                        }
                    }]
                }
            });
            sheetId = response.data.replies[0].addSheet.properties.sheetId;
            console.log('Created new Cumulative Chart sheet');
            
            // Add headers to the new sheet
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Cumulative Chart!A1',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [headers]
                }
            });
            
            // Add header formatting
            allFormatRequests.push({
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
            });
        }
        
        // Prepare updates for the current month
        const sortedDates = Array.from(monthData.keys()).sort();
        const valueUpdates = [];
        let currentRow = startRow;
        
        for (const dateStr of sortedDates) {
            const newRow = monthData.get(dateStr);
            const formattedDate = newRow[0];
            
            valueUpdates.push({
                range: `Cumulative Chart!A${currentRow}`,
                values: [newRow]
            });
            
            // Check if date should be gray (holidays)
            try {
                const [month, day] = formattedDate.split('/');
                const dateForChecking = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                
                const shouldBeGrayBackground = shouldBeGray(dateForChecking);
                
                if (shouldBeGrayBackground) {
                    allFormatRequests.push({
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: currentRow - 1,
                                endRowIndex: currentRow,
                                startColumnIndex: 0,
                                endColumnIndex: 1
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: {
                                        red: 0.8,
                                        green: 0.8,
                                        blue: 0.8
                                    }
                                }
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
        
        // Add column resizing
        allFormatRequests.push({
            autoResizeDimensions: {
                dimensions: {
                    sheetId: sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: headers.length
                }
            }
        });
        
        // Update current month data
        if (valueUpdates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: valueUpdates
                }
            });
        }
        
        // Apply all formatting
        if (allFormatRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: allFormatRequests
                }
            });
        }
        
        console.log(`Cumulative Chart updated successfully for ${month}/${year}`);
        
        return {
            spreadsheetId,
            sheetId,
            title: 'Cumulative Chart'
        };
        
    } catch (error) {
        console.error('Error in updateCumulativeSheet:', error);
        throw error;
    }
}

module.exports = {
    updateCumulativeSheet
};