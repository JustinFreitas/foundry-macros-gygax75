/**
 * FIND DOTTED PROPERTY KEYS
 * 
 * This script iterates over all actors and recursively checks for keys in their data
 * that contain a period (e.g. "items.0.img"). These likely result from flattened update
 * keys being treated as literal keys, which corrupts the data structure.
 */

// Configuration
const CHECK_SYSTEM_DATA = true; // Whether to deep check system data

function findDottedKeys(obj, path, actorName, foundKeys) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
        // Construct current path for logging context
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key contains a dot
        if (key.includes('.')) {
            const msg = `[Actor: ${actorName}] Found dotted key '${key}' at '${path}' (Full path: ${currentPath})`;
            console.warn(msg);
            foundKeys.push({
                actor: actorName,
                location: path,
                dottedKey: key,
                value: value
            });
        }

        // Recurse into objects
        // Avoid recursing into purely internal Foundry objects if necessary, but generally we want to check deeply
        if (typeof value === 'object' && value !== null) {
            findDottedKeys(value, currentPath, actorName, foundKeys);
        }
    }
}

console.log("Starting scan for dotted property keys (checking raw _source data)...");
const allFound = [];

game.actors.forEach(actor => {
    // Check _source to see the raw data as it exists in the DB, bypassing any data preparation
    // Fallback to toObject() if _source isn't available (though it should be on Actor5e)
    const actorData = actor._source || actor.toObject();

    const foundForActor = [];
    findDottedKeys(actorData, '', actor.name, foundForActor);

    if (foundForActor.length > 0) {
        allFound.push(...foundForActor);
    }
});

if (allFound.length > 0) {
    console.warn(`Scan complete. Found ${allFound.length} dotted keys across actors.`);
    console.table(allFound);
} else {
    console.log("Scan complete. No dotted keys found.");
}
