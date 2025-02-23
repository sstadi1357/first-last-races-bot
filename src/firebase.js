const admin = require("firebase-admin");
const serviceAccount = require("../service.json");
const firebaseId = require("./config/mainConfig.js");

// Initialize Firebase with databaseURL
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseId // Replace with your actual database URL
});

const db = admin.firestore()

module.exports = db;
