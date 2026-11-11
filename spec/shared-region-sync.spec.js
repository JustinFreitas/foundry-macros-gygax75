global.$ = (x) => x;
const fs = require('fs');
const { extractRegion, REGIONS } = require('../scripts/lib/sync-shared.js');

describe('shared helper regions', () => {
    for (const regionDef of REGIONS) {
        describe(regionDef.name, () => {
            const srcRegion = extractRegion(
                fs.readFileSync(regionDef.source, 'utf8'),
                regionDef.source,
                regionDef.begin,
                regionDef.end
            );
            it.each(regionDef.targets)('is in sync in %s', (target) => {
                const text = fs.readFileSync(target, 'utf8');
                const region = extractRegion(text, target, regionDef.begin, regionDef.end);
                expect(region).toBe(srcRegion);
            });
        });
    }
});
