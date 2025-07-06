// Search for target strings in Firebase
require('dotenv').config();
const { searchForStrings } = require('./src/utils/replaceStrings');

console.log('🔍 Searching for target strings in Firebase...');
console.log('Target strings: "uhhmm___" and "_uhhmm_"');
console.log('='.repeat(60));

searchForStrings()
    .then(() => {
        console.log('\n✨ Search completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Search failed:', error);
        process.exit(1);
    }); 