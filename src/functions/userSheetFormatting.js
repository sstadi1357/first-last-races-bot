// userSheetFormatting.js
const sheets = require('../sheets.js');
const { spreadsheetId } = require('../config/mainConfig');

/**
 * Converts hex color to RGB
 * @param {string} hex - Hex color code
 * @return {object} RGB object with r, g, b properties or null if invalid
 */
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  if (!/^[A-Fa-f0-9]{6}$/.test(hex)) {
    console.log(`Invalid hex color format: ${hex}`);
    return null;
  }
  
  try {
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    console.log(`Converted hex ${hex} to RGB: r=${r}, g=${g}, b=${b}`);
    return { r, g, b };
  } catch (error) {
    console.error(`Error converting hex to RGB: ${error}`);
    return null;
  }
}

/**
 * Determines whether to use black or white text based on background
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @return {object} Google Sheets API color object for black or white
 */
function getContrastColor(r, g, b) {
  // Calculate luminance - standard formula for perceived brightness
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Use white text for dark backgrounds, black text for light backgrounds
  console.log(`Calculated luminance: ${luminance.toFixed(2)}`);
  
  if (luminance > 0.5) {
    return { red: 0, green: 0, blue: 0 }; // Black
  } else {
    return { red: 1, green: 1, blue: 1 }; // White
  }
}

/**
 * Formats user cells in the Users sheet based on hex color
 * @param {number} row - Row number in the sheet
 * @param {string} hexColor - Hex color code
 * @return {Promise<boolean>} Success status
 */
async function formatAllUserCells() {
  console.log('Formatting all user cells based on hex colors in column B');
  
  try {
    // First, get the sheet ID and data for the 'Users' sheet
    const spreadsheetInfo = spreadsheetId
    const usersSheet = spreadsheetInfo.data.sheets.find(
      sheet => sheet.properties.title === 'Users'
    );
    
    if (!usersSheet) {
      console.error("Could not find 'Users' sheet in the spreadsheet");
      return false;
    }
    
    const sheetId = usersSheet.properties.sheetId;
    
    // Get all values from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:B'
    });
    
    const rows = response.data.values || [];
    const requests = [];
    
    // Process each row that has a hex color in column B
    rows.forEach((row, index) => {
      if (row && row[1]) { // If row exists and there's a hex color in column B
        let hexColor = row[1];
        if (!hexColor.startsWith('#')) {
          hexColor = '#' + hexColor;
        }
        
        const rgb = hexToRgb(hexColor);
        if (!rgb) return;
        
        const textColor = getContrastColor(rgb.r, rgb.g, rgb.b);
        
        // Format cells A and B for this row
        requests.push({
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: index,
              endRowIndex: index + 1,
              startColumnIndex: 0,
              endColumnIndex: 2
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: rgb.r / 255,
                  green: rgb.g / 255,
                  blue: rgb.b / 255
                },
                textFormat: {
                  foregroundColor: textColor
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat.foregroundColor)'
          }
        });
      }
    });
    
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });
      console.log(`Successfully formatted ${requests.length} rows`);
      return true;
    }
  } catch (error) {
    console.error(`Error formatting user cells: ${error}`);
    return false;
  }
}

module.exports = { formatAllUserCells, hexToRgb, getContrastColor };