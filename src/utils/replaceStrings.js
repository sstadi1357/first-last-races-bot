const db = require('../firebase');

/**
 * Diagnostic function to explore the Firebase database structure
 */
async function exploreDatabase() {
    console.log('🔍 Exploring Firebase database structure...\n');
    
    try {
        // Test basic Firebase connection
        console.log('🔌 Testing Firebase connection...');
        
        // Get all top-level collections
        const collections = await db.listCollections();
        console.log(`📁 Found ${collections.length} top-level collections:`);
        
        for (const collection of collections) {
            console.log(`\n🔍 Collection: ${collection.id}`);
            
            try {
                // Get documents in this collection
                const snapshot = await collection.get();
                console.log(`  📄 Documents: ${snapshot.size}`);
                
                if (snapshot.size > 0) {
                    console.log(`  📋 Document IDs: ${snapshot.docs.map(doc => doc.id).join(', ')}`);
                    
                    // Show first document structure
                    const firstDoc = snapshot.docs[0];
                    const firstDocData = firstDoc.data();
                    console.log(`  📊 First document keys: ${Object.keys(firstDocData).join(', ')}`);
                    
                    // Check first document for subcollections
                    const subcollections = await firstDoc.ref.listCollections();
                    if (subcollections.length > 0) {
                        console.log(`  📂 Subcollections in first document: ${subcollections.map(col => col.id).join(', ')}`);
                        
                        // Check first subcollection
                        const firstSubcol = subcollections[0];
                        const subcolSnapshot = await firstSubcol.get();
                        console.log(`    📄 Documents in ${firstSubcol.id}: ${subcolSnapshot.size}`);
                        if (subcolSnapshot.size > 0) {
                            console.log(`    📋 Sample document IDs: ${subcolSnapshot.docs.slice(0, 3).map(doc => doc.id).join(', ')}`);
                        }
                    }
                } else {
                    console.log(`  ⚠️  No documents found in ${collection.id}`);
                }
            } catch (error) {
                console.error(`  ❌ Error accessing collection ${collection.id}:`, error.message);
            }
        }
        
        console.log('\n' + '='.repeat(50));
        
    } catch (error) {
        console.error('❌ Error exploring database:', error);
        console.error('Full error:', error);
    }
}

/**
 * Get all top-level collections in the database
 */
async function getTopLevelCollections() {
    try {
        const collections = await db.listCollections();
        return collections.map(col => col.id);
    } catch (error) {
        console.error('❌ Error getting top-level collections:', error);
        return [];
    }
}

/**
 * Recursively searches through all documents in all collections and replaces strings
 * @param {string} searchString - The string to search for
 * @param {string} replaceString - The string to replace with
 * @param {string} collectionPath - The current collection path (for logging)
 */
async function replaceStringsInCollection(searchString, replaceString, collectionPath) {
    try {
        console.log(`🔍 Searching in collection: ${collectionPath}`);
        
        // Get all documents in the current collection
        const snapshot = await db.collection(collectionPath).get();
        
        if (snapshot.empty) {
            console.log(`📭 No documents found in ${collectionPath}`);
            return;
        }

        console.log(`📄 Found ${snapshot.size} documents in ${collectionPath}`);

        // Process each document
        for (const doc of snapshot.docs) {
            const docPath = `${collectionPath}/${doc.id}`;
            console.log(`\n📋 Processing document: ${docPath}`);
            
            const data = doc.data();
            let hasChanges = false;
            let updatedData = {};

            // Recursively process the document data
            const processObject = (obj, path = '') => {
                if (typeof obj !== 'object' || obj === null) {
                    return obj;
                }

                if (Array.isArray(obj)) {
                    return obj.map((item, index) => {
                        if (typeof item === 'string') {
                            const newValue = item.replace(new RegExp(searchString, 'g'), replaceString);
                            if (newValue !== item) {
                                hasChanges = true;
                                console.log(`  🔄 Replacing in array[${index}]: "${item}" → "${newValue}"`);
                            }
                            return newValue;
                        } else if (typeof item === 'object' && item !== null) {
                            return processObject(item, `${path}[${index}]`);
                        }
                        return item;
                    });
                } else {
                    const processed = {};
                    for (const [key, value] of Object.entries(obj)) {
                        const currentPath = path ? `${path}.${key}` : key;
                        
                        if (typeof value === 'string') {
                            const newValue = value.replace(new RegExp(searchString, 'g'), replaceString);
                            if (newValue !== value) {
                                hasChanges = true;
                                console.log(`  🔄 Replacing in ${currentPath}: "${value}" → "${newValue}"`);
                            }
                            processed[key] = newValue;
                        } else if (typeof value === 'object' && value !== null) {
                            processed[key] = processObject(value, currentPath);
                        } else {
                            processed[key] = value;
                        }
                    }
                    return processed;
                }
            };

            updatedData = processObject(data);

            // Update the document if changes were made
            if (hasChanges) {
                try {
                    await doc.ref.set(updatedData);
                    console.log(`✅ Updated document: ${docPath}`);
                } catch (error) {
                    console.error(`❌ Failed to update document ${docPath}:`, error);
                }
            } else {
                console.log(`✅ No changes needed for document: ${docPath}`);
            }

            // Check for subcollections
            const subcollections = await doc.ref.listCollections();
            for (const subcollection of subcollections) {
                const subcollectionPath = `${collectionPath}/${doc.id}/${subcollection.id}`;
                await replaceStringsInCollection(searchString, replaceString, subcollectionPath);
            }
        }

    } catch (error) {
        console.error(`❌ Error processing collection ${collectionPath}:`, error);
    }
}

/**
 * Main function to replace multiple strings across all collections
 */
async function replaceAllStrings() {
    console.log('🚀 Starting string replacement across all collections...\n');
    
    // Get all top-level collections
    const topLevelCollections = await getTopLevelCollections();
    
    if (topLevelCollections.length === 0) {
        console.log('❌ No collections found in the database');
        return;
    }
    
    console.log(`📁 Found ${topLevelCollections.length} top-level collections: ${topLevelCollections.join(', ')}\n`);
    
    const replacements = [
        { search: 'uhhmm___', replace: 'lljfioh' },
        { search: '_uhhmm_', replace: 'lljfioh' }
    ];

    for (const { search, replace } of replacements) {
        console.log(`\n🔄 Processing replacement: "${search}" → "${replace}"`);
        console.log('='.repeat(50));
        
        // Process each top-level collection
        for (const collection of topLevelCollections) {
            await replaceStringsInCollection(search, replace, collection);
        }
        
        console.log(`\n✅ Completed replacement: "${search}" → "${replace}"`);
        console.log('='.repeat(50));
    }

    console.log('\n🎉 All string replacements completed!');
}

/**
 * Search for documents containing specific strings across all possible paths
 */
async function searchForStrings() {
    console.log('🔍 Searching for documents containing target strings...\n');
    
    const searchStrings = ['uhhmm___', '_uhhmm_'];
    let foundDocuments = [];
    
    try {
        // Get all top-level collections
        const collections = await db.listCollections();
        console.log(`📁 Searching in ${collections.length} top-level collections...`);
        
        for (const collection of collections) {
            console.log(`\n🔍 Searching in collection: ${collection.id}`);
            
            try {
                const snapshot = await collection.get();
                console.log(`  📄 Found ${snapshot.size} documents`);
                
                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    const docPath = `${collection.id}/${doc.id}`;
                    
                    // Search for strings in this document
                    const searchInObject = (obj, path = '') => {
                        if (typeof obj !== 'object' || obj === null) return;
                        
                        if (Array.isArray(obj)) {
                            obj.forEach((item, index) => {
                                if (typeof item === 'string') {
                                    searchStrings.forEach(searchStr => {
                                        if (item.includes(searchStr)) {
                                            foundDocuments.push({
                                                path: `${docPath}${path}[${index}]`,
                                                value: item,
                                                searchString: searchStr
                                            });
                                        }
                                    });
                                } else if (typeof item === 'object' && item !== null) {
                                    searchInObject(item, `${path}[${index}]`);
                                }
                            });
                        } else {
                            for (const [key, value] of Object.entries(obj)) {
                                const currentPath = path ? `${path}.${key}` : key;
                                
                                if (typeof value === 'string') {
                                    searchStrings.forEach(searchStr => {
                                        if (value.includes(searchStr)) {
                                            foundDocuments.push({
                                                path: `${docPath}.${currentPath}`,
                                                value: value,
                                                searchString: searchStr
                                            });
                                        }
                                    });
                                } else if (typeof value === 'object' && value !== null) {
                                    searchInObject(value, currentPath);
                                }
                            }
                        }
                    };
                    
                    searchInObject(data);
                    
                    // Check subcollections
                    const subcollections = await doc.ref.listCollections();
                    for (const subcol of subcollections) {
                        const subcolSnapshot = await subcol.get();
                        console.log(`    📂 ${subcol.id}: ${subcolSnapshot.size} documents`);
                        
                        for (const subDoc of subcolSnapshot.docs) {
                            const subData = subDoc.data();
                            const subDocPath = `${docPath}/${subcol.id}/${subDoc.id}`;
                            
                            searchInObject(subData, subDocPath);
                        }
                    }
                }
                
            } catch (error) {
                console.error(`  ❌ Error accessing collection ${collection.id}:`, error.message);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🔍 SEARCH RESULTS:');
        console.log('='.repeat(60));
        
        if (foundDocuments.length === 0) {
            console.log('❌ No documents found containing the target strings');
        } else {
            console.log(`✅ Found ${foundDocuments.length} instances of target strings:`);
            foundDocuments.forEach((doc, index) => {
                console.log(`\n${index + 1}. Path: ${doc.path}`);
                console.log(`   Search string: "${doc.searchString}"`);
                console.log(`   Value: "${doc.value}"`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error searching for strings:', error);
    }
}

// Export the function for use in console
module.exports = {
    replaceAllStrings,
    replaceStringsInCollection,
    exploreDatabase,
    searchForStrings
};

// If this file is run directly, execute the replacement
if (require.main === module) {
    replaceAllStrings()
        .then(() => {
            console.log('\n✨ Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}