# first-last-races-bot
This is the First Last Races bot, which has all the functionality of First/Last Races. Most of the code is commented for clarity. If you need further assistance, please refer to the documentation or seek help from the community.

## Installation
1. This bot is designed to work with the First Last Races Server, but the code is open source and can be adapted for other uses.
2. Install the required dependencies:
    ```bash
    npm init -y
    npm install discord.js pm2 date-fns firebase-admin googleapis node-cron
    ```
## Configuration
1. Create a `config.json` file in the root directory with the following structure:
2. Create a service account from Firebase. Download the service account's JSON file and put it in the root directory. Ensure the service account has the following roles: Firebase Admin SDK Administrator Service Agent, Firebase Realtime Database Admin, Service Account Token Creator, Editor, Firebase Service Management Service Agent, and Viewer.
    {
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "clientId": "YOUR_DISCORD_CLIENT_ID"
    }
    ```
2. Create a service account from Firebase and download its `serviceAccountKey.json`, and put it in the root directory. Make sure to give the service account all the required scopes, which are: Firebase Admin SDK Administrator Service Agent, Firebase Realtime Database Admin, Service Account Token Creator, Editor, Firebase Service Management Service Agent, and Viewer.
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
9. it records the history in a google sheet using the Google Sheet API, which is right here: [Google Sheet](https://docs.google.com/spreadsheets/d/1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow/edit?gid=0#gid=0).

