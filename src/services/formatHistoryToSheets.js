// formatHistoryToSheets.js
const db = require('../firebase');
const sheets = require('../sheets');
const { format, parse } = require('date-fns');

// Configure the spreadsheet details
const SPREADSHEET_ID = '1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow';
const SERVER_ID = '1300198974988357732';

// Function to get month name
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

// Function to get sheet name from date
function getSheetName(dateStr) {
  const [month, day, year] = dateStr.split('-');
  return `${getMonthName(parseInt(month))} ${year}`;
}

async function getOrCreateSheet(sheetName) {
  try {
    // First check if the sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const existingSheet = spreadsheet.data.sheets.find(
      sheet => sheet.properties.title === sheetName
    );

    if (!existingSheet) {
      console.log(`Sheet "${sheetName}" not found, creating it...`);
      await sheets.spreadsheets.batchUpdate({
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
      return { exists: false, data: [] };
    }

    // Get data from existing sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`
    });
    return { exists: true, data: response.data.values || [] };
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

  console.log(`Maximum number of positions found: ${maxPositions}`);

  // Create headers array
  const headers = ['Date', 'Time'];
  
  for (let i = 1; i <= maxPositions; i++) {
    let positionHeader;
    if (i === 1) positionHeader = '1st';
    else if (i === 2) positionHeader = '2nd';
    else if (i === 3) positionHeader = '3rd';
    else positionHeader = `${i}th`;
    headers.push(positionHeader);
  }
  
  headers.push('2nd-Last', 'Last', 'Time');
  return { headers, maxPositions };
}

async function formatMessageHistory() {
  try {
    const { headers, maxPositions } = await getMaxPositionsAndCreateHeaders();
    
    // Group days by month
    const daysRef = db.collection('servers').doc(SERVER_ID).collection('days');
    const daysSnapshot = await daysRef.get();
    
    // Create a map to group data by month
    const monthlyData = new Map();
    
    // Process all days and group by month
    for (const dayDoc of daysSnapshot.docs) {
      const dayData = dayDoc.data();
      const dateStr = dayDoc.id; // Format: MM-DD-YYYY
      const sheetName = getSheetName(dateStr);
      
      if (!monthlyData.has(sheetName)) {
        monthlyData.set(sheetName, new Map());
      }
      
      if (!dayData.messages || !dayData.messages.length) {
        console.log(`No messages found for ${dateStr}`);
        continue;
      }

      // Sort messages by timestamp
      const sortedMessages = dayData.messages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Get timestamps and format as time for Sheets
      const firstMessageTime = new Date(sortedMessages[0].timestamp);
      const timeStr = format(firstMessageTime, 'HH:mm:ss');
      
      // Initialize positions array with 'NONE' values
      const positions = Array(maxPositions).fill('NONE');

      // Fill in all positions
      sortedMessages.forEach((msg, idx) => {
        positions[idx] = msg.username;
      });

      // Get second last and last from lastMessages object
      let secondLast = 'NONE';
      let last = 'NONE';
      let endTime = '';

      if (dayData.lastMessages) {
        if (dayData.lastMessages.last) {
          last = dayData.lastMessages.last.username;
          const timestamp = dayData.lastMessages.last.timestamp;
          const date = typeof timestamp === 'number' ? 
            new Date(timestamp) : 
            new Date(timestamp);
          endTime = format(date, 'HH:mm:ss');
        }
        if (dayData.lastMessages.secondLast) {
          secondLast = dayData.lastMessages.secondLast.username;
        }
      }

      // Format date for Sheets
      const [month, day, year] = dateStr.split('-');
      const formattedDate = `${year}-${month}-${day}`;

      const newRow = [
        formattedDate,
        timeStr,
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
      
      // Get or create sheet and its existing data
      const { exists, data: existingData } = await getOrCreateSheet(sheetName);
      
      // Set up headers if needed
      if (!exists || !existingData.length || !arraysEqual(existingData[0], headers)) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [headers]
          }
        });
      }

      // Create map of existing data
      const existingDataMap = new Map();
      if (existingData.length > 1) {
        existingData.slice(1).forEach(row => {
          const date = new Date(row[0]);
          const dateKey = format(date, 'MM-dd-yyyy');
          existingDataMap.set(dateKey, row);
        });
      }

      // Prepare updates
      const updates = [];
      let currentRow = 2; // Start after headers

      // Sort dates within the month
      const sortedDates = Array.from(monthData.keys()).sort();
      
      for (const dateStr of sortedDates) {
        const newRow = monthData.get(dateStr);
        const existingRow = existingDataMap.get(dateStr);
        
        if (!existingRow || !arraysEqual(existingRow, newRow)) {
          updates.push({
            range: `${sheetName}!A${currentRow}`,
            values: [newRow]
          });
        }
        currentRow++;
      }

      // Perform batch update if there are changes
      if (updates.length > 0) {
        console.log(`Updating ${updates.length} rows in ${sheetName}...`);
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: updates
          }
        });
        console.log(`Updates completed for ${sheetName}`);
      } else {
        console.log(`No updates needed for ${sheetName}`);
      }
    }

    console.log('All monthly sheets updated successfully');
  } catch (error) {
    console.error('Error formatting message history:', error);
    throw error;
  }
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

module.exports = { formatMessageHistory };