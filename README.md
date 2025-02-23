# First Last Races Bot

The **First Last Races Bot** is designed to track and rank the first and last messages sent by users in a Discord server each day. The bot records timestamps, assigns points, maintains leaderboards, and integrates with Firebase and Google Sheets for data storage. Most of the code is commented for clarity.

## Features

- Tracks the first and last messages sent by users each day.
- Assigns points based on message order.
- Maintains leaderboards and records history.
- Stores data in **Firebase Firestore** and **Google Sheets**.
- Customizable settings for server configuration, holiday dates, and presence status.

---

## Installation

### Prerequisites

Ensure you have the following:

- [Node.js](https://nodejs.org/)

### Setup Instructions

1. Create a new folder and clone the repository:
   ```bash
   mkdir First_Last_Races
   git clone https://github.com/sstadi1357/first-last-races-bot.git
   ```
2. Initialize the project and install dependencies:
   ```bash
   npm init -y
   npm install discord.js pm2 date-fns firebase-admin googleapis node-cron
   ```

---

## Configuration

### 1. **Discord Bot Token**

1. Create a `config.json` file in the root directory with the following structure:
<<<<<<< HEAD
    ```
    {
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "clientId": "YOUR_DISCORD_CLIENT_ID"
    }
    ```
2. Create a service account from Firebase. Download the service account's JSON file and put it in the root directory. Ensure the service account has the following roles: Firebase Admin SDK Administrator Service Agent, Firebase Realtime Database Admin, Service Account Token Creator, Editor, Firebase Service Management Service Agent, and Viewer.
3. Go to `src/config/mainConfig.js` and put in all of your values, such as server, main channel, flair announcement channel, points, database, sheet, etc.
4. You can set holiday dates in `src/config/holidayDates.js`. These dates will be grayed out in your sheet.
5. You can set optional presence values in `src/functions/presenceModule.js`.
1. Create a config.json in the root directory and put in your "token" and your "clientId" in the root with a string.
2. Create a service account from firebase and download its service.json, and put it in the root. Make sure to give the service account all the required scopes, which are, Firebase Admin SDK Administrator Service Agent, Firebase Realtime Database Admin, Service Account Token Creator, Editor, Firebase Service Management Service Agent, and Viewer.
3. Go to src/config/mainConfig.js and put in all of your values, such as server, main channel, flair announcement channel, points, database, sheet etc.
4. You can set holiday dates in src/config/holidayDates.js. These dates will be grayed out in your sheet.
5. You can set optional presence values in src/functions/presenceModule.js


## How it works
1. There is an event called Message List that listens for a message.
2. If the user who sent that message is already in the database (Firebase Firestore), it will not record their message. This way, only the user's first message is recorded. This resets every day.
3. The timestamps for all of the first messages are saved and arranged in order.
4. At the end of the day, based on the order, the user gets points:
   - 20 points for first place
   - 12 points for second place
   - etc.
5. It also checks the last message sent that day and the user who sent it and assigns them 20 extra points.
6. It assigns the second-last message's user 10 points.
7. Then, it puts all the users in a leaderboard.
8. It records the history in the database.
9. it records the history in a google sheet using the Google Sheet API.
=======
   ```json
   {
     "token": "YOUR_DISCORD_BOT_TOKEN",
     "clientId": "YOUR_DISCORD_CLIENT_ID"
   }
   ```

### 2. **Firebase Setup**

1. Create a Firebase project and generate a service account key.
2. Download the JSON key file and place it in the root directory.
3. Ensure the service account has the following roles:
   1. Firebase Admin SDK Administrator Service Agent
   2. Firebase Realtime Database Admin
   3. Service Account Token Creator
   4. Editor
   5. Firebase Service Management Service Agent
   6. Viewer

### 3. **Google Sheets Setup**

1. Go to your project in Google Cloud.
2. Enable the Google Sheets API.
3. Create a new sheet and save the Sheet ID.

### 4. **Additional Configurations**

1. Edit `src/config/mainConfig.js` to specify:
   1. Server ID
   2. Firebase Firestore Database ID
   3. Google Sheets Spreadsheet ID
   4. Main Channel ID
   5. Flair Announcement Channel ID
   6. Roles
   7. Points Settings
   8. Scheduler
2. Set holiday dates in `src/config/holidayDates.js`. These dates will be grayed out in the sheet.
3. Customize optional presence values in `src/functions/presenceModule.js`.

---

## How It Works

1. The bot listens for messages in the server.
2. If a user sends their first message of the day, it is recorded in the database.
3. Messages sent after the first one by the same user are ignored for ranking purposes.
4. At the end of the day:
   1. The first user to send a message gets **20 points**.
   2. The second user gets **12 points**, the third user gets **10 points**, and so on.
   3. The last user to send a message receives **20 bonus points**.
   4. The second-last user gets **10 bonus points**.
5. A leaderboard is generated based on accumulated points.
6. The history is stored in:
   1. **Firebase Firestore** for long-term storage.
   2. **Google Sheets** using the Google Sheets API for a visual representation.

---

## Getting Started

1. Start the bot using Node.js:
   ```bash
   node index.js
   ```
2. Alternatively, use PM2 for process management:
   ```bash
   pm2 start index.js --name "first-last-races-bot"
   ```
3. Check logs for any issues:
   ```bash
   pm2 logs first-last-races-bot
   ```

---

