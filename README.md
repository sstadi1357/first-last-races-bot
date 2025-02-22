# first-last-races-bot
First Last Races bot that has all the functionality of First/Last Races. Most code is commented so you will understand. If you don't, ask ai to explain it to you. This is private, so if you're looking at this, your name is Shaehan Tadiparthi and you either lost your files for the bot or they disappeared. Make sure to put all of this in a folder and install node.js, discord.js, and pm2. Also, this bot only works if the flair announcements channel is "flair-announcements," and the main channel to get points is "general-races." This is not made for all servers yet. It only works for https://discord.com/channels/1300198974988357732/1300198975437275147 (The First Last Races Server). There is no way to config it currently.

How it works:
1. There is an event called Message List that listens for a message. If the user who sent that message is already in the database (firebase firestore), it will not record their message. This way, only the user's first message is recorded. This resets every day.
2. The timestamps for all of the first messages are saved and arranged in order. At the end of the day, based on the order, the user gets points. If they get first place they get 20 points, 12 for second place, etc. It also checks the last message sent that day and the user who sent it and assigns them 20 extra points. It also assigns the second-last message's user 10 points.
3. Then, it puts all the users in a leaderboard. It records the history in the database.

Only for the First Last Races Server, it records the history in a google sheet using the Google Sheet API, which is right here: https://docs.google.com/spreadsheets/d/1CH85wIWmj0H6zgnjkNtHm_rYIlW_8AFM4z16G44W8ow/edit?gid=0#gid=0.
Look at package.json to see all the packages that were used.
