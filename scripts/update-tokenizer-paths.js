/**
 * UPDATE TOKENIZER PATHS
 * 
 * Scans all Actors and World Items for properties containing ForgeVTT URLs
 * with "/tokenizer/" in the path.
 * 
 * Replaces them with local paths starting with "tokenizer/".
 * Example: https://assets.forge-vtt.com/.../tokenizer/npcs/goblin.png?123
 * Becomes: tokenizer/npcs/goblin.png
 * 
 * SAFETY:
 * Default is DRY_RUN = true. No changes will be made until you set it to false.
 */

// Configuration
const DRY_RUN = true; // Set to false to actually apply updates
const FORGE_URL_PREFIX = 'https://assets.forge-vtt.com';
const TOKENIZER_FILTER = '/tokenizer/';

function expandObject(obj) {
    const expanded = {};
    for (const [key, value] of Object.entries(obj)) {
        let current = expanded;
        const parts = key.split('.');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = value;
            } else {
                current[part] = current[part] || {};
                current = current[part];
            }
        }
    }
    return expanded;
}

function checkObject(obj, path, docName, updates) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string') {
            if (value.startsWith(FORGE_URL_PREFIX) && value.includes(TOKENIZER_FILTER)) {

                // Extract relative path after /tokenizer/
                const parts = value.split(TOKENIZER_FILTER);
                if (parts.length > 1) {
                    // Strip query params
                    const relativePath = parts[1].split('?')[0];
                    const newPath = `tokenizer/${relativePath}`;

                    if (DRY_RUN) {
                        console.log(`[Dry Run] [${docName}] Would update '${currentPath}':\n  Old: ${value}\n  New: ${newPath}`);
                    }

                    updates[currentPath] = newPath;
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            checkObject(value, currentPath, docName, updates);
        }
    }
}

function processCollection(collection, typeLabel) {
    console.log(`Scanning ${typeLabel} for Tokenizer links...`);
    let updateCount = 0;

    collection.forEach(document => {
        // Use toObject() for clear data inspection
        const docData = typeof document.toObject === 'function' ? document.toObject() : document;
        const updates = {};

        checkObject(docData, '', document.name, updates);

        if (Object.keys(updates).length > 0) {
            updateCount++;
            if (!DRY_RUN) {
                // We need to expand the flat keys back to nested object for update() 
                // IF we were doing a diff update, but document.update() usually handles dot notation fine
                // HOWEVER, to be safe and standard with previous scripts, lets pass the expanded object
                // actually document.update({ "system.details.biography": val }) IS supported and safer for partials

                // Let's rely on Foundry's flat key support for updates which is standard
                // But wait, previous scripts used expandObject. 
                // Let's use expandObject to be consistent with the user's prior "check" script patterns
                const expandedUpdates = expandObject(updates);

                console.log(`Updating ${document.name}...`);
                document.update(expandedUpdates);
            }
        }
    });

    console.log(`[${typeLabel}] Found updates for ${updateCount} documents.`);
}

console.log(`Starting Tokenizer Path Update (DRY_RUN: ${DRY_RUN})...`);

processCollection(game.actors, "Actors");
processCollection(game.items, "World Items");

if (DRY_RUN) {
    console.warn("\n!!! THIS WAS A DRY RUN. NO CHANGES WERE MADE. !!!");
    console.warn("Set 'const DRY_RUN = false;' at the top of the script to apply changes.");
} else {
    console.log("\nUpdate Complete.");
}
