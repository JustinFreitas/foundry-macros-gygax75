/**
 * FORGE ASSET AUDITOR & DOWNLOADER
 * 
 * 1. Scans all world documents for assets.forge-vtt.com links.
 * 2. Checks each link's HTTP status (HEAD request) to find 404s.
 * 3. Reports BROKEN vs VALID links.
 * 4. Generates a Windows `curl` batch script to download all VALID assets locally.
 * 
 * Instructions:
 * - Execute this macro.
 * - Open the browser console (F12) to see progress and the final report.
 */

(async () => {
    console.log("%cForge Asset Auditor | Execution Started", "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");

    const FORGE_URL_PREFIX = 'assets.forge-vtt.com';
    const CONCURRENCY_LIMIT = 5;
    const TARGET_DATA_SUBDIR = 'forge-migration'; // Final local folder: Data/forge-migration/

    const visited = new WeakSet();
    const foundLinks = new Map(); // Map<URL, {docs: Set<string>, type: string}>

    /**
     * Recursively find Forge links in objects
     */
    function scanObject(obj, path, docName, typeLabel, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 50) return;
        if (visited.has(obj)) return;
        visited.add(obj);

        try {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;

                if (typeof value === 'string' && value.includes(FORGE_URL_PREFIX)) {
                    if (!foundLinks.has(value)) {
                        foundLinks.set(value, {
                            docs: new Set(),
                            url: value
                        });
                    }
                    foundLinks.get(value).docs.add(`[${typeLabel}] ${docName} (${currentPath})`);
                } else if (typeof value === 'object' && value !== null) {
                    scanObject(value, currentPath, docName, typeLabel, depth + 1);
                }
            }
        } catch (e) {
            // Ignore access errors
        }
    }

    /**
     * Check link status in batches
     */
    async function checkLink(urlData) {
        try {
            // Using HEAD request to check existence without downloading the whole file
            const response = await fetch(urlData.url, { method: 'HEAD' });
            if (response.ok) {
                urlData.status = 'VALID';
            } else if (response.status === 404) {
                urlData.status = 'BROKEN';
            } else {
                urlData.status = `ERROR (${response.status})`;
            }
        } catch (e) {
            urlData.status = 'FAILED (CORS/Network)';
        }
        return urlData;
    }

    async function auditForgeAssets() {
        console.log("Step 1: Scanning all world documents for Forge links...");
        
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
                scanObject(data, '', doc.name || doc.id || "Unknown", label);
            });
        }

        const uniqueUrls = Array.from(foundLinks.values());
        const total = uniqueUrls.length;
        console.log(`Found ${total} unique Forge URLs to check.`);

        if (total === 0) {
            console.log("%cNo Forge links found.", "color: green; font-weight: bold;");
            return;
        }

        console.log(`Step 2: Checking link statuses (Concurrency: ${CONCURRENCY_LIMIT})...`);
        
        const results = [];
        for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY_LIMIT) {
            const batch = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);
            console.log(`Checking ${i + 1} - ${Math.min(i + CONCURRENCY_LIMIT, total)} / ${total}...`);
            const checkedBatch = await Promise.all(batch.map(urlData => checkLink(urlData)));
            results.push(...checkedBatch);
        }

        // --- Reporting ---
        const valid = results.filter(r => r.status === 'VALID');
        const broken = results.filter(r => r.status === 'BROKEN');
        const errored = results.filter(r => !['VALID', 'BROKEN'].includes(r.status));

        console.log(`%cAudit Results: ${valid.length} Valid, ${broken.length} Broken, ${errored.length} Errored.`, "color: blue; font-weight: bold;");

        if (broken.length > 0) {
            console.group("%cBROKEN LINKS (404) - These assets are missing from Forge:", "color: red; font-weight: bold;");
            broken.forEach(r => {
                console.log(`URL: ${r.url}`);
                r.docs.forEach(d => console.log(`  └─ Affected: ${d}`));
            });
            console.groupEnd();
        }

        if (errored.length > 0) {
            console.group("%cINCONCLUSIVE LINKS - Error status or CORS blocked:", "color: orange; font-weight: bold;");
            errored.forEach(r => {
                console.log(`[${r.status}] URL: ${r.url}`);
            });
            console.groupEnd();
        }

        // --- Script Generation ---
        if (valid.length > 0) {
            console.log(`\n%cStep 3: Generating Preservation Script for ${valid.length} valid assets...`, "color: green; font-weight: bold;");
            
            const commands = valid.map(r => {
                // Parse the URL to get a local path
                // https://assets.forge-vtt.com/user-id/path/to/file.png
                // -> forge-migration/user-id/path/to/file.png
                let urlStr = r.url;
                if (urlStr.startsWith('https://')) urlStr = urlStr.replace('https://', '');
                
                const parts = urlStr.split('/');
                parts.shift(); // remove assets.forge-vtt.com
                
                const relativePath = parts.join('\\').split('?')[0]; // Windows backslashes, no query params
                
                // Construct curl: curl "URL" --create-dirs -o "Data\forge-migration\..."
                return `curl "${r.url}" --create-dirs -o "Data\\${TARGET_DATA_SUBDIR}\\${relativePath}"`;
            });

            console.log(`\n=== COPY THE TEXT BELOW TO A FILE NAMED 'download_forge.bat' ===\n`);
            console.log(`@echo off`);
            console.log(`echo Starting Forge Migration Download...`);
            console.log(`mkdir "Data\\${TARGET_DATA_SUBDIR}" 2>nul`);
            console.log(commands.join('\n'));
            console.log(`echo Download Complete! Files are in Data/${TARGET_DATA_SUBDIR}`);
            console.log(`pause`);
            console.log(`\n=== END OF SCRIPT ===`);
            
            console.log("\n%cTo apply these changes once downloaded:", "color: blue; font-weight: bold;");
            console.log(`Run a search-and-replace macro to replace 'https://${FORGE_URL_PREFIX}/' with '${TARGET_DATA_SUBDIR}/'`);
        }

        console.log("%cForge Asset Auditor | Audit Complete.", "color: blue; font-weight: bold; border: 1px solid blue; padding: 2px;");
    }

    if (typeof game !== 'undefined' && game.ready) {
        await auditForgeAssets();
    } else {
        console.error("This script must be run as a Foundry VTT macro when the world is loaded.");
    }
})();
