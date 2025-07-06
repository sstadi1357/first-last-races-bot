// Simple console script to replace strings in Firebase
require('dotenv').config();
const { replaceAllStrings } = require('./src/utils/replaceStrings');

console.log('🚀 Starting Firebase string replacement...');
console.log('This will replace "uhhmm___" and "_uhhmm_" with "lljfioh" in all documents');
console.log('='.repeat(60));

replaceAllStrings()
    .then(() => {
        console.log('\n✨ Replacement completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Replacement failed:', error);
        process.exit(1);
    }); 