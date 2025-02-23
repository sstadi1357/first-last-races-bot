//RUN THIS CODE EVERY TIME NEW COMMANDS ARE CREATED
require('dotenv').config(); // Load environment variables from a .env file
// Import modules
const { REST, Routes } = require('discord.js');
const clientId = process.env.DISCORD_CLIENT_ID;
const fs = require('fs');
const path = require('path');

// Array to store command data to be registered globally
const commands = [];

// Determine the path to the 'commands' directory
const foldersPath = path.join(__dirname, 'commands');

// Read all subdirectories (categories) within the 'commands' directory
const commandFolders = fs.readdirSync(foldersPath);

// Loop through each category to retrieve and prepare commands
for (const folder of commandFolders) {
    // Determine the path to each category (subdirectory) of commands
    const commandsPath = path.join(foldersPath, folder);
    
    // Filter and retrieve all JavaScript files within the category (subdirectory)
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    // Loop through each command file within the category
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath); // Load the command module
        
        // Check if the loaded command module has required properties
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON()); // Add command data to the commands array
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Initialize an instance of the REST module with API version '10' and set bot token
const rest = new REST({ version: '10' }).setToken(token);

// Immediately-invoked function expression (IIFE) to deploy commands globally
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Use REST put method to deploy commands globally for the bot
        const data = await rest.put(
            Routes.applicationCommands(clientId), // Route to register global commands
            { body: commands }, // Commands data to be deployed
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error(error); // Log any errors that occur during deployment
    }
})();
