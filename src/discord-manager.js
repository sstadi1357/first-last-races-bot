// Import necessary modules
require('dotenv').config();
const readline = require('readline');
const { Client, Events, Collection, GatewayIntentBits } = require("discord.js");
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const path = require('node:path');
const fs = require('node:fs');
console.log(token)

class DiscordBotManager {
    constructor() {
        // Initialize the Discord client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // Initialize collections
        this.client.commands = new Collection();
        this.client.cooldowns = new Collection();
        // this.client.aiModule = new AiModule();

        // Initialize readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    // Load commands from the commands directory
    loadCommands() {
        const foldersPath = path.join(__dirname, 'commands');
        const commandFolders = fs.readdirSync(foldersPath);

        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);

                // Check for required properties
                if ('data' in command && 'execute' in command) {
                    this.client.commands.set(command.data.name, command);
                    
                    // Initialize command if it has an init method
                    if (typeof command.init === 'function') {
                        command.init().catch(error => {
                            console.error(`Error initializing command ${command.data.name}:`, error);
                        });
                    }

                    console.log(`[LOADED] Command: ${command.data.name}${command.autocomplete ? ' (with autocomplete)' : ''}`);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
                }
            }
        }
    }
    // Load events from the events directory
    loadEvents() {
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);

            if (event.once) {
                this.client.once(event.name, (...args) => event.execute(...args, this.client));
            } else {
                this.client.on(event.name, (...args) => event.execute(...args, this.client));
            }
        }
    }

    // Start the bot
    async start() {
        try {
            console.log('Loading commands...');
            this.loadCommands();

            console.log('Loading events...');
            this.loadEvents();
            
            console.log('Logging in...');
            await this.client.login(token);

            console.log('Bot successfully started!');

        } catch (error) {
            console.error('Error starting the bot:', error);
            this.stop();
        }
    }

    // Stop the bot
    async stop() {
        try {
            console.log('Shutting down bot...');
            await this.client.destroy();
            this.rl.close();
            console.log('Bot successfully terminated.');
            process.exit(0);
        } catch (error) {
            console.error('Error stopping the bot:', error);
            process.exit(1);
        }
    }
}

// Export the DiscordBotManager class
module.exports = DiscordBotManager;