global.$ = (x) => x;

describe('container-and-encumbrance-checker.js', () => {

    // Helper function extracted from the original script for testing
    function isWhiteListedTopLevelItem(item) {
        return item.name.startsWith('Case')
            || item.name.endsWith('Cloak')
            || item.name.startsWith('Gauntlets')
            || item.name.startsWith('Girdle')
            || item.name.startsWith('Helm')
            || item.name.startsWith('Medallion')
            || item.name.startsWith('Quiver')
            || item.name.endsWith('Ring')
            || item.name.startsWith('Ring')
            || [
                'Elven Cloak and Boots',
                'GP (Bank)',
                'Holy symbol',
                'Lantern',
                'Oil flask',
                'Saddle and Bridle',
                'Scarab of Protection',
                'Torch',
                'Waterskin'
                ].includes(item.name);
    }

    describe('isWhiteListedTopLevelItem', () => {
        it('should return true for items starting with Case', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Case of Scrolls' })).toBe(true);
        });

        it('should return true for items ending with Cloak', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Magic Cloak' })).toBe(true);
        });

        it('should return true for items starting with Gauntlets', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Gauntlets of Ogre Power' })).toBe(true);
        });

        it('should return true for items starting with Girdle', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Girdle of Giant Strength' })).toBe(true);
        });

        it('should return true for items starting with Helm', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Helm of Brilliance' })).toBe(true);
        });

        it('should return true for items starting with Medallion', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Medallion of Thought' })).toBe(true);
        });

        it('should return true for items starting with Quiver', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Quiver of Ehlonna' })).toBe(true);
        });

        it('should return true for items ending with Ring', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Magic Ring' })).toBe(true);
        });

        it('should return true for items starting with Ring', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Ring of Protection' })).toBe(true);
        });

        it('should return true for specific whitelisted items', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Elven Cloak and Boots' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'GP (Bank)' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Holy symbol' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Lantern' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Oil flask' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Saddle and Bridle' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Scarab of Protection' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Torch' })).toBe(true);
            expect(isWhiteListedTopLevelItem({ name: 'Waterskin' })).toBe(true);
        });

        it('should return false for non-whitelisted items', () => {
            expect(isWhiteListedTopLevelItem({ name: 'Sword' })).toBe(false);
            expect(isWhiteListedTopLevelItem({ name: 'Potion' })).toBe(false);
            expect(isWhiteListedTopLevelItem({ name: 'Amulet' })).toBe(false);
            expect(isWhiteListedTopLevelItem({ name: "Rider's Gear" })).toBe(false); // This item is whitelisted in the other script, but not this one.
        });
    });

    describe('container capacity regex', () => {
        const fs = require('fs');
        const path = require('path');

        // Pull the exact regex literal out of the source so this test guards the
        // real pattern, not a copy. Previously it carried a /g flag, which made
        // .exec() stateful (lastIndex persisting) and could skip matches when
        // reused across containers.
        const source = fs.readFileSync(
            path.resolve(__dirname, '../scripts/container-and-encumbrance-checker.js'),
            'utf8'
        );
        const regexLiteral = source.match(/\/\^\.\*\\\(.*?\$\/[a-z]*/)[0];
        const flags = regexLiteral.slice(regexLiteral.lastIndexOf('/') + 1);

        it('does not use the global flag (avoids stateful exec across containers)', () => {
            expect(flags).not.toContain('g');
        });

        it('extracts capacity consistently across many sequential containers', () => {
            // eslint-disable-next-line no-eval
            const pattern = eval(regexLiteral);
            const names = ['Backpack (40)', 'Sack (60)', 'Pouch (5)', 'Chest (200)'];
            const capacities = names.map(name => {
                const m = pattern.exec(name);
                return m?.groups?.capacity;
            });
            // Every container must match; a leftover lastIndex would yield nulls.
            expect(capacities).toEqual(['40', '60', '5', '200']);
        });
    });
});
