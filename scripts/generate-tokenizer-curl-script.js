/**
 * GENERATE TOKENIZER CURL SCRIPT
 * 
 * Scans all Actors and World Items for properties containing ForgeVTT URLs
 * that differ from the standard Bazaar assets (specifically looking for /tokenizer/).
 * 
 * Generates a batch script output of curl commands to download these assets
 * to a local local specific folder.
 */

// Configuration
// Set this to your world's tokenizer data folder, e.g.
// String.raw`C:\Users\<you>\AppData\Local\FoundryVTT-<World>\Data\tokenizer`
const TARGET_DIR = String.raw`C:\Users\<you>\AppData\Local\FoundryVTT\Data\tokenizer`;
const FORGE_URL_PREFIX = 'https://assets.forge-vtt.com';
const TOKENIZER_FILTER = '/tokenizer/';

// Set to store unique URLs to avoid duplicates in the script
const foundUrls = new Set();
// Store commands
const commands = [];

function checkObject(obj) {
    if (!obj || typeof obj !== 'object') return;

    for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
            if (value.startsWith(FORGE_URL_PREFIX) && value.includes(TOKENIZER_FILTER)) {
                if (!foundUrls.has(value)) {
                    foundUrls.add(value);

                    // Extract relative path after /tokenizer/
                    // Example: .../tokenizer/npcs/goblin.png -> npcs/goblin.png
                    const parts = value.split(TOKENIZER_FILTER);
                    if (parts.length > 1) {
                        const relativePath = parts[1].split('?')[0];
                        // Convert forward slashes to backslashes for Windows path
                        const localRelativePath = relativePath.replace(/\//g, '\\');

                        // Construct curl command
                        // curl "URL" --create-dirs -o "PATH\relative\path\filename"
                        // we use --create-dirs to automatically create the relative folder structure
                        const command = `curl "${value}" --create-dirs -o "${TARGET_DIR}\\${localRelativePath}"`;
                        commands.push(command);
                    }
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            checkObject(value);
        }
    }
}

function processCollection(collection, typeLabel) {
    console.log(`Scanning ${typeLabel} for Tokenizer links...`);
    collection.forEach(document => {
        // Use toObject() for clear data
        const docData = typeof document.toObject === 'function' ? document.toObject() : document;
        checkObject(docData);
    });
}

console.log("Starting Generation of Tokenizer Download Script...");

processCollection(game.actors, "Actors");
processCollection(game.items, "World Items");

if (commands.length > 0) {
    console.log(`\n\n=== COPY THE TEXT BELOW THIS LINE ===\n`);
    console.log(`@echo off`);
    console.log(`mkdir "${TARGET_DIR}" 2>nul`); // Try to create root dir just in case
    console.log(commands.join('\n'));
    console.log(`\n=== END OF SCRIPT ===`);
    console.log(`Found ${commands.length} unique files to download.`);
} else {
    console.log("No Tokenizer links found.");
}
