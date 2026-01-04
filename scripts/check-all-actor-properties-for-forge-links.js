const FORGE_URL_PREFIX = 'https://assets.forge-vtt.com';

function checkObject(obj, path, actorName, updates) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string') {
            if (value.startsWith(FORGE_URL_PREFIX) && !value.includes('/bazaar/')) {

                if (value.includes('/systems/')) {
                    const systemsIndex = value.indexOf('systems/');
                    const newPath = value.substring(systemsIndex);
                    console.log(`[Actor: ${actorName}] Replace '${value}' with '${newPath}' at '${currentPath}'`);

                    // Helper to set nested property in updates object
                    // Note: Actor.update usually accepts flattened keys like "system.details.biography": "value"
                    // checking Foundry docs, update({ "system.prop": val }) is valid.
                    updates[currentPath] = newPath;

                } else {
                    console.log(`[Actor: ${actorName}] Found other Forge URL at '${currentPath}': '${value}'`);
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            checkObject(value, currentPath, actorName, updates);
        }
    }
}

// Helper to expand flattened keys into nested objects
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

function processCollection(collection, typeLabel) {
    console.log(`Scanning ${typeLabel}...`);
    collection.forEach(document => {
        // Convert to object to avoid circular references and methods
        // Use toObject() to get a clean data representation
        const docData = typeof document.toObject === 'function' ? document.toObject() : document;
        const updates = {};

        checkObject(docData, '', document.name, updates);

        if (Object.keys(updates).length > 0) {
            const expandedUpdates = expandObject(updates);
            console.log(`Updates for [${typeLabel}] ${document.name}:`, JSON.stringify(expandedUpdates, null, 2));
            // document.update(expandedUpdates);
        }
    });
}

console.log("Starting Forge Link Check...");
processCollection(game.actors, "Actor");
processCollection(game.items, "Item");
console.log("Forge Link Check Complete.");
