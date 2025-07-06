// Test script to access the specific server document
require('dotenv').config();
const db = require('./src/firebase');
const { serverId } = require('./src/config/mainConfig');

console.log('🔍 Testing server document access...');
console.log(`Server ID: ${serverId}`);
console.log('='.repeat(60));

async function testServerAccess() {
    try {
        // Try to access the specific server document
        const serverRef = db.collection('servers').doc(serverId);
        const serverDoc = await serverRef.get();
        
        if (serverDoc.exists) {
            console.log('✅ Server document exists!');
            const data = serverDoc.data();
            console.log(`📊 Document keys: ${Object.keys(data).join(', ')}`);
            
            // Check for subcollections
            const subcollections = await serverRef.listCollections();
            console.log(`📂 Subcollections: ${subcollections.map(col => col.id).join(', ')}`);
            
            if (subcollections.length > 0) {
                for (const subcol of subcollections) {
                    const subcolSnapshot = await subcol.get();
                    console.log(`  📄 ${subcol.id}: ${subcolSnapshot.size} documents`);
                    if (subcolSnapshot.size > 0) {
                        console.log(`    📋 Sample IDs: ${subcolSnapshot.docs.slice(0, 5).map(doc => doc.id).join(', ')}`);
                    }
                }
            }
        } else {
            console.log('❌ Server document does not exist');
            
            // List all documents in servers collection
            const serversSnapshot = await db.collection('servers').get();
            console.log(`📄 Total documents in servers: ${serversSnapshot.size}`);
            if (serversSnapshot.size > 0) {
                console.log(`📋 Document IDs: ${serversSnapshot.docs.map(doc => doc.id).join(', ')}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error accessing server:', error);
    }
}

testServerAccess()
    .then(() => {
        console.log('\n✨ Test completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    }); 