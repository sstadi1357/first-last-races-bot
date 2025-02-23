# First Last Races Bot

The **First Last Races Bot** is designed to track and rank the first and last messages sent by users in a Discord server each day. The bot records timestamps, assigns points, maintains leaderboards, and integrates with Firebase and Google Sheets for data storage. Most of the code is commented for clarity. If you need further assistance, refer to the documentation or seek help from the community.

## Features
- Tracks the first and last messages sent by users each day.
- Assigns points based on message order.
- Maintains leaderboards and records history.
- Stores data in **Firebase Firestore** and **Google Sheets**.
- Customizable settings for server configuration, holiday dates, and presence status.

---

## Installation
### Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/)
- A Firebase project with a service account

### Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/first-last-races-bot.git
   cd first-last-races-bot
   ```
2. Initialize the project and install dependencies:
   ```bash
   npm init -y
   npm install discord.js pm2 date-fns firebase-admin googleapis node-cron
   ```

---

## Configuration
### 1. **Discord Bot Token**
Create a `config.json` file in the root directory with the following structure:
```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "clientId": "YOUR_DISCORD_CLIENT_ID"
}
```

### 2. **Firebase Setup**
- Create a Firebase project and generate a service account key.
- Download the JSON key file and place it in the root directory.
- Ensure the service account has the following roles:
  - Firebase Admin SDK Administrator Service Agent
  - Firebase Realtime Database Admin
  - Service Account Token Creator
  - Editor
  - Firebase Service Management Service Agent
  - Viewer

### 3. **Additional Configurations**
- Edit `src/config/mainConfig.js` to specify:
  - Server ID
  - Main channel ID
  - Flair announcement channel ID
  - Points system settings
  - Database and Google Sheets integration details
- Set holiday dates in `src/config/holidayDates.js`. These dates will be grayed out in the sheet.
- Customize optional presence values in `src/functions/presenceModule.js`.

---

## How It Works
1. The bot listens for messages in the server.
2. If a user sends their first message of the day, it is recorded in the database.
3. Messages sent after the first one by the same user are ignored for ranking purposes.
4. At the end of the day:
   - The first user to send a message gets **20 points**.
   - The second user gets **12 points**, and so on.
   - The last user to send a message receives **20 bonus points**.
   - The second-last user gets **10 points**.
5. A leaderboard is generated based on accumulated points.
6. The history is stored in:
   - **Firebase Firestore** for long-term storage.
   - **Google Sheets** using the Google Sheets API.

---

## Usage
- Start the bot using PM2:
  ```bash
  pm2 start bot.js --name first-last-races-bot
  ```
- To stop the bot:
  ```bash
  pm2 stop first-last-races-bot
  ```
- To view logs:
  ```bash
  pm2 logs first-last-races-bot
  ```

---

## Contributing
Contributions are welcome! Feel free to open issues and pull requests to improve the bot.

---

## License
This project is open-source and available under the **MIT License**.

---

## Contact
For support or inquiries, reach out via GitHub issues or the community Discord server.

