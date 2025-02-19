// sheets.js - Google Sheets API configuration
const { google } = require("googleapis");
const serviceAccount = require("./service.json"); // Using the same service account key

// Authenticate with the service account
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets" // Full access to Google Sheets
  ],
});

// Initialize the Sheets API
const sheets = google.sheets({ version: "v4", auth });

// Export the sheets instance to use in other files
module.exports = sheets;
