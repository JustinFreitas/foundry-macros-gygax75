/*
 * Copies the shared helper region from treasure-stow-helpers.js into every
 * macro that inlines it (between the BEGIN/END SHARED markers).
 *
 * Run:  node scripts/lib/sync-shared.js          (writes the macros)
 *       node scripts/lib/sync-shared.js --check   (exits non-zero if drift)
 *
 * The spec also enforces this, so CI catches drift even if you forget to run it.
 */
const fs = require("fs");
const path = require("path");

const BEGIN = "// <<< BEGIN SHARED: treasure-stow-helpers >>>";
const END = "// <<< END SHARED: treasure-stow-helpers >>>";

const root = path.resolve(__dirname, "..");
const SOURCE = path.join(__dirname, "treasure-stow-helpers.js");
const TARGETS = [
    path.join(root, "actor-treasure-stow.js"),
    path.join(root, "consolidate-items-in-containers.js"),
];

function extractRegion(text, file) {
    const start = text.indexOf(BEGIN);
    const end = text.indexOf(END);
    if (start === -1 || end === -1) {
        throw new Error(`Missing SHARED markers in ${file}`);
    }
    return text.slice(start, end + END.length);
}

const sourceRegion = extractRegion(fs.readFileSync(SOURCE, "utf8"), SOURCE);
const check = process.argv.includes("--check");
let drift = false;

for (const target of TARGETS) {
    const text = fs.readFileSync(target, "utf8");
    const targetRegion = extractRegion(text, target);
    if (targetRegion === sourceRegion) continue;

    if (check) {
        drift = true;
        console.error(`DRIFT: ${path.basename(target)} shared region differs from source.`);
    } else {
        fs.writeFileSync(target, text.replace(targetRegion, sourceRegion));
        console.log(`Synced shared region into ${path.basename(target)}.`);
    }
}

if (check && drift) process.exit(1);
if (check) console.log("Shared regions are in sync.");

module.exports = { extractRegion, sourceRegion, SOURCE, TARGETS, BEGIN, END };
