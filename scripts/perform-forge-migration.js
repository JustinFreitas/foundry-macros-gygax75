/**
 * PERFORM FORGE ASSET MIGRATION (V4 - Delta & Token Safety)
 *
 * This script migrates all Forge VTT asset links (assets.forge-vtt.com) to local paths.
 * V4 handles "Token Deltas" separately to avoid "changes is not iterable" TypeErrors.
 *
 * USE THIS WHEN: you need the delta-safe migration and don't need link
 * verification. To verify links (HEAD-check for 404s) and get a broken-asset
 * journal instead, use migrate-forge-links-to-local.js.
 */

(async () => {
    // --- Configuration ---
    const DRY_RUN = true; 
    const LOCAL_PREFIX = 'forge-migration'; // Folder in 'Data/'
    const FORGE_DOMAIN = 'assets.forge-vtt.com';
    const LOG_FILE_NAME = "Forge Migration: Final Audit Log";

    console.log(`%cForge Migration V4 | Execution Started (DRY_RUN: ${DRY_RUN})`, "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");

    // --- Safety Check for Local Folder ---
    try {
        await FilePicker.browse("data", LOCAL_PREFIX);
    } catch (e) {
        ui.notifications.error(`Forge Migration Aborted: Folder 'Data/${LOCAL_PREFIX}' not found.`);
        return;
    }

    const docToUpdates = new Map(); 
    const urlSummary = new Map(); 
    const corruptedMacros = [];

    // Regex to find: https://assets.forge-vtt.com/USER_ID/path/to/file.ext?query
    const FORGE_URL_REGEX = /https?:\/\/assets\.forge-vtt\.com\/[^\/"\s ]+\/([^\s"? ]+)(?:\?[^"\s ]*)?/g;

    function smartReplace(value) {
        if (typeof value !== 'string' || !value.includes(FORGE_DOMAIN)) return value;
        return value.replace(FORGE_URL_REGEX, (match, pathOnly) => {
            const newPath = `${LOCAL_PREFIX}/${pathOnly}`;
            if (!urlSummary.has(match)) urlSummary.set(match, { count: 0, newPath: newPath });
            urlSummary.get(match).count++;
            return newPath;
        });
    }

    /**
     * Recursively find Forge links in a POJO object, skipping embedded collections.
     */
    function scanForLinks(obj, updates, path = "", depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 50) return;

        // SKIP EMBEDDED DOCUMENTS/COLLECTIONS - they must be handled as separate documents
        const EMBEDDED_KEYS = [
            "items", "effects", "pages", "tokens", "tiles", "drawings", 
            "walls", "lights", "sounds", "templates", "notes", "cards", 
            "results", "delta" // "delta" is the critical one for the iterable error
        ];

        for (const [key, value] of Object.entries(obj)) {
            if (depth === 0 && EMBEDDED_KEYS.includes(key)) continue;

            const currentPath = path ? `${path}.${key}` : key;

            if (typeof value === 'string' && value.includes(FORGE_DOMAIN)) {
                const newValue = smartReplace(value);
                if (newValue !== value) updates[currentPath] = newValue;
            } else if (typeof value === 'object' && value !== null) {
                scanForLinks(value, updates, currentPath, depth + 1);
            }
        }
    }

    /**
     * Process a single document and its children
     */
    async function processDocument(doc) {
        if (!doc) return;

        // Corruption Detection for Macros
        if (doc.documentName === "Macro" && doc.command && doc.command.startsWith(LOCAL_PREFIX)) {
            corruptedMacros.push(doc);
            return;
        }

        // 1. Scan this document's direct properties
        const updates = {};
        const data = doc.toObject();
        scanForLinks(data, updates);

        if (Object.keys(updates).length > 0) {
            docToUpdates.set(doc, updates);
        }

        // 2. Recurse into common embedded collections
        const collectionKeys = ["items", "effects", "pages", "tokens", "tiles", "drawings", "results", "cards"];
        for (const cKey of collectionKeys) {
            const collection = doc[cKey];
            if (collection && typeof collection[Symbol.iterator] === 'function') {
                for (const subDoc of collection) {
                    await processDocument(subDoc);
                }
            }
        }

        // 3. Recurse into single sub-documents (Deltas)
        if (doc.delta) {
            await processDocument(doc.delta);
        }
    }

    // --- Execution ---
    const worldCollections = {
        "Actors": game.actors, "Items": game.items, "Scenes": game.scenes,
        "Journal": game.journal, "Tables": game.tables, "Playlists": game.playlists,
        "Cards": game.cards, "Macros": game.macros, "Users": game.users
    };

    console.log("Starting Scan V4 (Delta Safety)...");
    for (const collection of Object.values(worldCollections)) {
        if (!collection) continue;
        for (const doc of collection) {
            await processDocument(doc);
        }
    }

    // --- Reporting ---
    if (corruptedMacros.length > 0) {
        console.group("%cCORRUPTED MACROS DETECTED (Alert)", "color: red; font-weight: bold;");
        corruptedMacros.forEach(m => console.log(`- ${m.name} (ID: ${m.id})`));
        console.groupEnd();
    }

    if (docToUpdates.size === 0) {
        console.log("%cNo Forge links found.", "color: green; font-weight: bold;");
        ui.notifications.info("Forge Migration: No NEW links found.");
        return;
    }

    console.group(`Migration Prepared: ${docToUpdates.size} Entities Affected`);
    for (const [doc, updates] of docToUpdates.entries()) {
        const docName = doc.name || doc.id || "Unknown";
        const type = doc.documentName || "Embedded";
        
        if (DRY_RUN) {
            console.log(`[Dry Run] ${type} | ${docName}:`, updates);
        } else {
            try {
                await doc.update(updates);
                console.log(`Updated ${type} | ${docName}`);
            } catch (err) {
                console.error(`Failed to update ${type} | ${docName}:`, err);
            }
        }
    }
    console.groupEnd();

    if (DRY_RUN) {
        ui.notifications.warn("Dry run complete. Check F12 console.");
    } else {
        ui.notifications.info("Migration complete!");
    }
})();
