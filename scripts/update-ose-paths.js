/**
 * UPDATE OSE PATHS
 * 
 * Scans world documents for any paths containing "systems/ose"
 * If a path does not start with "systems/ose" (e.g. has a migration prefix like forge-migration/...),
 * it will strip the prefix so the path starts directly with "systems/ose".
 * 
 * SAFETY:
 * Default is DRY_RUN = true. No changes will be made until you set it to false.
 */

// Configuration
const DRY_RUN = true; // Set to false to actually apply updates
const TARGET_STRINGS = [
    'systems/ose',
    'modules/justins-gygax-75-module'
];

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
        // Skip known embedded document arrays when checking the parent document's root properties.
        // We will process these collections independently to avoid Foundry's flat mapping issues.
        const embeddedKeys = ['items', 'effects', 'results', 'tokens', 'tiles', 'drawings', 'notes', 'lights', 'sounds', 'templates', 'pages'];
        if (path === '' && embeddedKeys.includes(key)) {
            continue;
        }

        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string') {
            // Skip multi-line strings (like code blocks or long HTML text)
            if (value.includes('\n') || value.includes('\r')) continue;

            // Skip strings that appear to contain HTML markup, Markdown, or Foundry UUID links
            if (/<[^>]+>/.test(value) || /\[.*\]/.test(value) || /\*\*.*\*\*/.test(value)) continue;

            // Normalize path separators to forward slashes for easier checking
            const normalizedValue = value.replace(/\\/g, '/');

            // Check against each target string
            for (const target of TARGET_STRINGS) {
                const targetIndex = normalizedValue.indexOf(target);

                // If it contains the target but does NOT start with it (or /target)
                if (targetIndex > 0 && !normalizedValue.startsWith('/' + target)) {
                    const newPath = normalizedValue.substring(targetIndex);

                    if (DRY_RUN) {
                        console.log(`[Dry Run] [${docName}] Would update '${currentPath}':\n  Old: ${value}\n  New: ${newPath}`);
                    }

                    updates[currentPath] = newPath;
                    break; // Move to the next string property once we've matched and replaced
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            checkObject(value, currentPath, docName, updates);
        }
    }
}

function processCollection(collection, typeLabel) {
    if (!collection) return;
    
    console.log(`Scanning ${typeLabel} for target paths...`);
    let updateCount = 0;

    // Use Array.from to safely handle both Document Collections and Arrays
    Array.from(collection).forEach(document => {
        // Use toObject() for clear data inspection
        const docData = typeof document.toObject === 'function' ? document.toObject() : document;
        const updates = {};

        checkObject(docData, '', document?.name || 'Unknown Document', updates);

        if (Object.keys(updates).length > 0) {
            updateCount++;
            if (!DRY_RUN && typeof document.update === 'function') {
                // Expand the flat keys back to a nested object for update()
                const expandedUpdates = expandObject(updates);

                console.log(`Updating ${document.name}...`);
                document.update(expandedUpdates);
            }
        }

        // Recursively process any embedded data collections (like RollTable results or Actor items)
        const embeddedKeys = ['items', 'effects', 'results', 'tokens', 'tiles', 'drawings', 'notes', 'lights', 'sounds', 'templates', 'pages'];
        embeddedKeys.forEach(ek => {
            if (document[ek] && typeof document[ek].forEach === 'function' && document[ek].size > 0) {
                // Using recursive processing for embedded collections
                processCollection(document[ek], `${document.name} (${ek})`);
            }
        });
    });

    if (updateCount > 0) {
        console.log(`[${typeLabel}] Found updates for ROOT properties of ${updateCount} documents.`);
    }
}

console.log(`Starting Path Prefix Reset (DRY_RUN: ${DRY_RUN})...`);

const collections = {
    "Actors": game.actors,
    "Items": game.items,
    "Scenes": game.scenes,
    "Journal": game.journal,
    "Tables": game.tables,
    "Playlists": game.playlists,
    "Cards": game.cards,
    "Macros": game.macros,
    "Users": game.users,
    "Folders": game.folders,
    "Messages": game.messages
};

for (const [label, collection] of Object.entries(collections)) {
    processCollection(collection, label);
}

if (DRY_RUN) {
    console.warn("\n!!! THIS WAS A DRY RUN. NO CHANGES WERE MADE. !!!");
    console.warn("Set 'const DRY_RUN = false;' at the top of the script to apply changes.");
} else {
    console.log("\nUpdate Complete.");
}
