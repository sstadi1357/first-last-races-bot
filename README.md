# first-last-races-bot
First Last Races bot that has all the functionality of First/Last Races. Most code is commented so you will understand. If you don't, ask AI to explain it to you.

## Installation
- This bot is private and only works for the First Last Races Server.
2. Install the required dependencies:
    ```bash
    npm init -y
    npm install discord.js pm2 date-fns firebase-admin googleapis node-cron
    ```

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
- This bot only works if the flair announcements channel is "flair-announcements," and the main channel to get points is "general-races."
Only for the First Last Races Server, it records the history in a google sheet using the Google Sheet API, which is right here: [Google Sheet](https://docs.google.com/spreadsheets/d/1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow/edit?gid=0#gid=0).
Look at package.json to see all the packages that were used.

## Package Information (package.json)
```json
{
  "name": "first_last-races",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "date-fns": "^4.1.0",
    "discord.js": "^14.16.3",
    "firebase-admin": "^12.7.0",
    "googleapis": "^144.0.0",
    "node-cron": "^3.0.3"
  }
}
```
