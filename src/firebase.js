const admin = require("firebase-admin");
const serviceAccount = require("./service.json");

// Initialize Firebase with databaseURL
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://first-last-races-default-rtdb.firebaseio.com" // Replace with your actual database URL
});

const db = admin.firestore()

module.exports = db;
