/*
 * Copies each shared helper region from scripts/lib/*.js into every macro that
 * inlines it (between the BEGIN/END SHARED markers).
 *
 * Run:  node scripts/lib/sync-shared.js          (writes the macros)
 *       node scripts/lib/sync-shared.js --check   (exits non-zero if drift)
 *
 * The spec also enforces this, so CI catches drift even if you forget to run it.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const REGIONS = [
    {
        name: "treasure-stow-helpers",
        begin: "// <<< BEGIN SHARED: treasure-stow-helpers >>>",
        end: "// <<< END SHARED: treasure-stow-helpers >>>",
        source: path.join(__dirname, "treasure-stow-helpers.js"),
        targets: [
            path.join(root, "actor-treasure-stow.js"),
            path.join(root, "consolidate-items-in-containers.js"),
        ],
    },
    {
        name: "procedure-runner",
        begin: "// <<< BEGIN SHARED: procedure-runner >>>",
        end: "// <<< END SHARED: procedure-runner >>>",
        source: path.join(__dirname, "procedure-runner.js"),
        targets: [
            path.join(root, "procedure-departure.js"),
            path.join(root, "procedure-dungeon-turn.js"),
            path.join(root, "procedure-expedition-return.js"),
            path.join(root, "procedure-return.js"),
        ],
    },
];

// Backward-compatible default constants for treasure-stow-helpers
const BEGIN = REGIONS[0].begin;
const END = REGIONS[0].end;
const SOURCE = REGIONS[0].source;
const TARGETS = REGIONS[0].targets;

function extractRegion(text, file, beginMarker = BEGIN, endMarker = END) {
    const start = text.indexOf(beginMarker);
    const end = text.indexOf(endMarker);
    if (start === -1 || end === -1) {
        throw new Error(`Missing SHARED markers (${beginMarker}) in ${file}`);
    }
    return text.slice(start, end + endMarker.length);
}

const sourceRegion = extractRegion(fs.readFileSync(SOURCE, "utf8"), SOURCE, BEGIN, END);

function syncRegions({ check = false } = {}) {
    let drift = false;
    for (const region of REGIONS) {
        const srcRegion = extractRegion(
            fs.readFileSync(region.source, "utf8"),
            region.source,
            region.begin,
            region.end
        );
        for (const target of region.targets) {
            const text = fs.readFileSync(target, "utf8");
            const targetRegion = extractRegion(text, target, region.begin, region.end);
            if (targetRegion === srcRegion) continue;

            if (check) {
                drift = true;
                console.error(`DRIFT: ${path.basename(target)} shared region (${region.name}) differs from source.`);
            } else {
                fs.writeFileSync(target, text.replace(targetRegion, srcRegion));
                console.log(`Synced shared region (${region.name}) into ${path.basename(target)}.`);
            }
        }
    }
    return drift;
}

if (require.main === module) {
    const check = process.argv.includes("--check");
    const drift = syncRegions({ check });
    if (check && drift) process.exit(1);
    if (check) console.log("Shared regions are in sync.");
}

module.exports = { extractRegion, syncRegions, REGIONS, sourceRegion, SOURCE, TARGETS, BEGIN, END };
