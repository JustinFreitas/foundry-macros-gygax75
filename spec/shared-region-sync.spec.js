global.$ = (x) => x;
const fs = require('fs');
const { extractRegion, sourceRegion, TARGETS } = require('../scripts/lib/sync-shared.js');

describe('shared helper region', () => {
    it.each(TARGETS)('is in sync in %s', (target) => {
        const text = fs.readFileSync(target, 'utf8');
        const region = extractRegion(text, target);
        expect(region).toBe(sourceRegion);
    });
});
