/**
 * MIGRATE FORGE LINKS TO LOCAL ASSETS
 *
 * USE THIS WHEN: you want links verified before migrating — it HEAD-checks every
 * Forge URL and writes a "Broken Assets" journal for any 404s. It does NOT skip
 * embedded Token deltas, so if you hit a "changes is not iterable" error use
 * perform-forge-migration.js (V4) instead, which is delta-safe but unverified.
 *
 * 1. Scans world documents for assets.forge-vtt.com links.
 * 2. Checks each link's status (HEAD) to identify Valid vs Broken assets.
 * 3. Migrates Valid links to point to the local `forge-migration/` folder.
 * 4. Creates a "Forge Migration: Broken Assets Log" Journal Entry for anything missing.
 * 
 * SAFETY:
 * - Default DRY_RUN = true. No changes will be made until you set it to false.
 * - Set LOCAL_PREFIX if you've moved the files from 'forge-migration/'.
 */

(async () => {
    // --- Configuration ---
    const DRY_RUN = true; 
    const LOCAL_PREFIX = 'forge-migration/'; // Path relative to Data/
    const FORGE_DOMAIN = 'assets.forge-vtt.com';
    const CONCURRENCY_LIMIT = 5;

    console.log(`%cForge Migration | Execution Started (DRY_RUN: ${DRY_RUN})`, "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");

    const visited = new WeakSet();
    const uniqueForgeUrls = new Map(); // Map<URL, {status: string, docs: Map<DocId, Set<property_path>>}>
    const docToUpdates = new Map(); // Map<DocRef, {updates: Object}>

    /**
     * Recursively find Forge links
     */
    function scanObject(obj, doc, path, typeLabel, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 50) return;
        if (visited.has(obj)) return;
        visited.add(obj);

        try {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;

                if (typeof value === 'string' && value.includes(FORGE_DOMAIN)) {
                    if (!uniqueForgeUrls.has(value)) {
                        uniqueForgeUrls.set(value, { status: null, docs: new Map() });
                    }
                    const urlInfo = uniqueForgeUrls.get(value);
                    if (!urlInfo.docs.has(doc.uuid)) urlInfo.docs.set(doc.uuid, new Set());
                    urlInfo.docs.get(doc.uuid).add(currentPath);
                } else if (typeof value === 'object' && value !== null) {
                    scanObject(value, doc, currentPath, typeLabel, depth + 1);
                }
            }
        } catch (e) {}
    }

    /**
     * Transform URL to Local Path
     */
    function transformToLocal(url) {
        // https://assets.forge-vtt.com/user-id/path/to/file.png
        // -> forge-migration/user-id/path/to/file.png
        let urlStr = url;
        if (urlStr.startsWith('https://')) urlStr = urlStr.replace('https://', '');
        
        const parts = urlStr.split('/');
        parts.shift(); // remove domain (assets.forge-vtt.com)
        
        const relativePath = parts.join('/').split('?')[0]; // Join with forward slashes for Foundry, strip query
        return `${LOCAL_PREFIX}${relativePath}`;
    }

    /**
     * Check link status (HEAD)
     */
    async function checkLink(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok ? 'VALID' : (response.status === 404 ? 'BROKEN' : 'ERROR');
        } catch (e) {
            return 'INCONCLUSIVE';
        }
    }

    async function runMigration() {
        console.log("Step 1: Discovering Forge links in world documents...");
        
        const collections = {
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

        for (const [label, collection] of Object.entries(collections)) {
            if (!collection) continue;
            console.log(`Scanning ${label}...`);
            collection.forEach(doc => {
                const data = typeof doc.toObject === 'function' ? doc.toObject() : doc;
                scanObject(data, doc, '', label);
            });
        }

        const urlsToVerify = Array.from(uniqueForgeUrls.keys());
        console.log(`Step 2: Verifying ${urlsToVerify.length} unique Forge URLs...`);

        for (let i = 0; i < urlsToVerify.length; i += CONCURRENCY_LIMIT) {
            const batch = urlsToVerify.slice(i, i + CONCURRENCY_LIMIT);
            console.log(`Checking ${i + 1} - ${Math.min(i + CONCURRENCY_LIMIT, urlsToVerify.length)} / ${urlsToVerify.length}...`);
            const statusResults = await Promise.all(batch.map(url => checkLink(url)));
            batch.forEach((url, index) => {
                uniqueForgeUrls.get(url).status = statusResults[index];
            });
        }

        // --- Prepare Updates ---
        console.log("Step 3: Preparing and applying updates...");
        let updatedCount = 0;
        let brokenItems = [];

        for (const [url, info] of uniqueForgeUrls.entries()) {
            const newPath = transformToLocal(url);
            
            if (info.status === 'BROKEN') {
                brokenItems.push({ url, docs: info.docs });
                // We will still update the path to the local location (with a [BROKEN] prefix in the log)
                // so that the user can fix the files locally.
            }

            for (const [uuid, paths] of info.docs.entries()) {
                const doc = fromUuidSync(uuid);
                if (!doc) continue;

                if (!docToUpdates.has(doc)) docToUpdates.set(doc, {});
                const updates = docToUpdates.get(doc);
                
                paths.forEach(p => {
                    updates[p] = newPath;
                    updatedCount++;
                });
            }
        }

        // --- Apply Updates ---
        for (const [doc, updates] of docToUpdates.entries()) {
            if (DRY_RUN) {
                console.log(`[Dry Run] [${doc.documentName}] ${doc.name}:`, JSON.stringify(updates, null, 2));
            } else {
                console.log(`Updating [${doc.documentName}] ${doc.name}...`);
                await doc.update(updates);
            }
        }

        // --- Handle Broken Links Audit Log ---
        if (brokenItems.length > 0) {
            console.warn(`%cFound ${brokenItems.length} Broken Forge links. Generating Audit Log Journal...`, "font-weight: bold;");
            
            let content = `<h2>Forge Migration: Broken Assets Audit Log</h2>
            <p>The following assets were missing from The Forge (404) at the time of migration. They were updated to local paths in <code>${LOCAL_PREFIX}</code>, but you will need to manually populate those files.</p>
            <table border="1">
                <thead><tr><th>Broken URL</th><th>Affected Document(s) / Properties</th></tr></thead>
                <tbody>`;

            brokenItems.forEach(item => {
                let affectedStr = "";
                for (const [uuid, paths] of item.docs.entries()) {
                    const doc = fromUuidSync(uuid);
                    const link = doc ? `@UUID[${uuid}]{${doc.name}}` : "Unknown Document";
                    affectedStr += `<strong>${link}</strong>: ${Array.from(paths).join(', ')}<br>`;
                }
                content += `<tr><td>${item.url}</td><td>${affectedStr}</td></tr>`;
            });
            content += `</tbody></table>`;

            if (!DRY_RUN) {
                // Check if a log already exists to avoid duplicates
                let existing = game.journal.find(j => j.name === "Forge Migration: Broken Assets Log");
                if (existing) {
                    await existing.update({ pages: [{ name: `Migration Audit - ${new Date().toLocaleString()}`, type: "text", text: { content } }] });
                } else {
                    await JournalEntry.create({
                        name: "Forge Migration: Broken Assets Log",
                        pages: [{
                            name: `Migration Audit - ${new Date().toLocaleString()}`,
                            type: "text",
                            text: { content }
                        }]
                    });
                }
                console.log("%cAudit Log Journal Entry Created.", "color: green; font-weight: bold;");
            } else {
                console.log("[Dry Run] Would create Broken Assets Audit Log Journal Entry.");
            }
        }

        console.table({
            "Unique Forge URLs Migrated": uniqueForgeUrls.size,
            "Total Property Updates": updatedCount,
            "Broken Assets Tracked": brokenItems.length
        });

        if (DRY_RUN) {
            console.warn("\n!!! THIS WAS A DRY RUN. NO CHANGES WERE MADE. !!!");
            console.warn("Set 'const DRY_RUN = false;' at the top of the script to apply changes.");
        } else {
            console.log("%cMigration Complete.", "color: green; font-weight: bold;");
        }
        
        console.log("%cForge Migration | Execution Complete", "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");
    }

    if (typeof game !== 'undefined' && game.ready) {
        await runMigration();
    } else {
        console.error("This script must be run as a Foundry VTT macro when the world is loaded.");
    }
})();
