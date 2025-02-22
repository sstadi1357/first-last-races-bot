#!/bin/bash

# Navigate to the project directory (update this path to your project folder)
cd /Users/gopalakrishnatadiparthi/First_Last_Races

# Pull the latest changes from GitHub (replace "main" with "master" if needed)
git pull origin main --allow-unrelated-histories

# Add all local changes
git add .

# Commit the changes with a timestamp message
git commit -m "Auto sync on $(date)"

# Push the changes to GitHub
git push origin main

# Print success message
echo "Changes successfully synced with GitHub!"
