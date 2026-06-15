/**
 * FIND FORGE LINKS
 * 
 * Scans all world documents (Actors, Items, Scenes, Journals, Tables, Playlists, Cards, Macros, Users)
 * for properties containing 'assets.forge-vtt.com' URLs.
 * 
 * Lists findings in the browser console (F12).
 */

(async () => {
    // Immediate log to confirm execution
    console.log("%cFind Forge Links Macro | Execution Started", "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");

    const FORGE_URL_PREFIX = 'assets.forge-vtt.com';
    const visited = new WeakSet();

    /**
     * Recursively checks an object for strings containing the Forge URL prefix.
     */
    function checkObject(obj, path, docName, typeLabel, found, depth = 0) {
        // Safety checks: null, not an object, too deep, or already visited
        if (!obj || typeof obj !== 'object' || depth > 50) return;
        if (visited.has(obj)) return;
        visited.add(obj);

        try {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;

                if (typeof value === 'string') {
                    if (value.includes(FORGE_URL_PREFIX)) {
                        found.push({
                            type: typeLabel,
                            name: docName,
                            path: currentPath,
                            url: value
                        });
                    }
                } else if (typeof value === 'object' && value !== null) {
                    checkObject(value, currentPath, docName, typeLabel, found, depth + 1);
                }
            }
        } catch (err) {
            // Silently ignore errors in deep property access (e.g. permission issues or getters)
        }
    }

    /**
     * Main search function
     */
    async function findForgeLinks() {
        console.log("Initializing search across all world collections...");
        const allFound = [];

        const collectionsMap = {
            "Actors": game.actors,
            "Items": game.items,
            "Scenes": game.scenes,
            "Journal": game.journal,
            "Tables": game.tables,
            "Playlists": game.playlists,
            "Cards": game.cards,
            "Macros": game.macros,
            "Users": game.users
        };

        for (const [label, collection] of Object.entries(collectionsMap)) {
            if (!collection) {
                console.log(`[!] Collection ${label} not found or inaccessible.`);
                continue;
            }
            
            const count = collection.size ?? collection.contents?.length ?? 0;
            console.log(`Scanning ${label} (${count} documents)...`);
            
            collection.forEach(doc => {
                try {
                    // Use toObject() for raw data; fallback to the doc itself if not available
                    const data = typeof doc.toObject === 'function' ? doc.toObject() : doc;
                    checkObject(data, '', doc.name || doc.id || "Unknown", label, allFound);
                } catch (e) {
                    console.error(`Error scanning ${label} document ${doc.name || doc.id}:`, e);
                }
            });
        }

        if (allFound.length === 0) {
            console.log("%cNo Forge links found.", "color: green; font-weight: bold;");
        } else {
            console.log(`%cFound ${allFound.length} Forge links:`, "color: orange; font-weight: bold;");
            
            // Group findings for better readability
            const grouped = allFound.reduce((acc, curr) => {
                if (!acc[curr.type]) acc[curr.type] = [];
                acc[curr.type].push(curr);
                return acc;
            }, {});

            for (const [type, links] of Object.entries(grouped)) {
                console.group(`${type} (${links.length})`);
                links.forEach(f => {
                    console.log(`${f.name} > ${f.path}: ${f.url}`);
                });
                console.groupEnd();
            }
            
            // Summary table for a bird's eye view
            const summaryTable = Object.entries(grouped).map(([type, links]) => ({
                "Document Type": type,
                "Link Count": links.length
            }));
            console.table(summaryTable);
        }
        
        console.log("%cFind Forge Links Macro | Search Complete.", "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");
    }

    // Execution entry point
    if (typeof game !== 'undefined') {
        if (game.ready) {
            await findForgeLinks();
        } else {
            console.warn("Foundry is still loading (game.ready is false). Please wait and try again.");
            // Wait for game ready event if possible, but for a macro manual trigger is better
        }
    } else {
        console.error("This script must be run as a Foundry VTT macro in a browser environment.");
        alert("Macro Execution Error: 'game' object not found. Are you running this in the Foundry VTT macro editor?");
    }
})();
