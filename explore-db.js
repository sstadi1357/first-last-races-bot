// Diagnostic script to explore Firebase database structure
require('dotenv').config();
const { exploreDatabase } = require('./src/utils/replaceStrings');

console.log('🔍 Exploring Firebase database structure...');
console.log('='.repeat(60));

exploreDatabase()
    .then(() => {
        console.log('\n✨ Database exploration completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Database exploration failed:', error);
        process.exit(1);
    }); 