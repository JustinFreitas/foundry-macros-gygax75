/**
 * INSPECT ACTOR DATA
 * 
 * Inspects a specific actor's data structure to verify if keys contain dots or if they are nested.
 * Targeted at 'Zombie Snake-Priestess' based on user report.
 */

const targetName = "Zombie Snake-Priestess";
const actor = game.actors.find(a => a.name === targetName);

if (!actor) {
    console.error(`Actor '${targetName}' not found.`);
} else {
    console.log(`Inspecting Actor: ${actor.name}`);
    const data = actor.toObject();

    // Check 'items' specifically
    if (data.items) {
        console.log(`'items' type: ${Array.isArray(data.items) ? 'Array' : typeof data.items}`);
        if (Array.isArray(data.items)) {
            data.items.forEach((item, index) => {
                console.log(`Item [${index}] keys:`, Object.keys(item));
                // Check for dotted keys in item
                Object.keys(item).forEach(k => {
                    if (k.includes('.')) console.warn(`!!! FOUND DOTTED KEY IN ITEM: '${k}'`);
                });
            });
        } else {
            console.log(`'items' keys:`, Object.keys(data.items));
        }
    }

    // Deep check for dotted keys on this specific actor with verbose logging
    function checkDeep(obj, path) {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;

            if (key.includes('.')) {
                console.warn(`!!! FOUND DOTTED KEY: '${key}' at '${path}'`);
            }

            if (path === 'items' || path.startsWith('items.')) {
                // Log traversal through items to show structure
                // console.log(`Visited: ${currentPath} (Key: '${key}')`);
            }

            if (typeof value === 'object' && value !== null) {
                checkDeep(value, currentPath);
            }
        }
    }

    console.log("Starting deep scan of target actor...");
    checkDeep(data, '');
    console.log("Deep scan complete.");
}
