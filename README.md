# First Last Races Bot

The **First Last Races Bot** is designed to track and rank the first and last messages sent by users in a Discord server each day. The bot records timestamps, assigns points, maintains leaderboards, and integrates with Firebase and Google Sheets for data storage. Most of the code is commented for clarity.

## Features

- Tracks the first and last messages sent by users each day.
- Assigns points based on message order.
- Maintains leaderboards and records history.
- Stores data in **Firebase Firestore** and **Google Sheets**.
- Customizable settings for server configuration, holiday dates, and presence status.

## Installation

### Prerequisites

Ensure you have the following:

- [Node.js](https://nodejs.org/)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/sstadi1357/first-last-races-bot.git
   cd first-last-races-bot
   ```
2. Install dependencies:
   ```bash
   npm install discord.js pm2 date-fns firebase-admin googleapis node-cron dotenv
   ```

## Configuration

### 1. **Discord Bot Setup**

1. Create a `.env` file in the `src` folder:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_bot_client_id_here
   ```
2. Configure settings in ``src/config/mainConfig.json``:
   - Server ID
   - Database and Google Sheets integration
   - Channels and roles
   - Points system
   - Scheduler options
3. Set holiday dates in `src/config/holidayDates.js` (grayed out in the sheet).
4. Customize presence values in `src/functions/presenceModule.js`.

### 2. **Firebase Setup**

1. Create a Firebase project and generate a service account key.
2. Download the JSON key file and place it in the root directory.
3. Ensure the service account has the following roles:
   - Firebase Admin SDK Administrator Service Agent
   - Firebase Realtime Database Admin
   - Service Account Token Creator
   - Editor
   - Firebase Service Management Service Agent
   - Viewer

### 3. **Google Sheets Setup**

1. Enable the Google Sheets API in Google Cloud.
2. Create a new sheet and save the Sheet ID.
3. Add the Sheet ID to `src/config/mainConfig.js`.
4. Adjust the users and and their color values in `src/config/mainConfig.js`.

## How It Works

1. The bot listens for messages in the server.
2. If a user sends their first message of the day, it is recorded in the database.
3. Messages sent after the first one by the same user are ignored for ranking purposes.
4. At the end of the day:
   - The first user to send a message gets **20 points**.
   - The second user gets **12 points**, the third user gets **10 points**, and so on.
   - The last user to send a message receives **20 bonus points**.
   - The second-last user gets **10 bonus points**.
5. A leaderboard is generated based on accumulated points.
6. The history is stored in **Firebase Firestore** and **Google Sheets**.

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

