
describe('container-and-encumbrance-checker-with-mounts.js', () => {

    // Helper function extracted from the original script for testing
    function isWhiteListedTopLevelItem(item) {
        return item.name.startsWith('Case')
            || item.name.endsWith('Cloak')
            || item.name.startsWith('Gauntlets')
            || item.name.startsWith('Girdle')
            || item.name.startsWith('Helm')
            || item.name.startsWith('Medallion')
            || item.name.startsWith('Quiver')
            || item.name.startsWith('Rider')
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

        it('should return true for items starting with Rider', () => {
            expect(isWhiteListedTopLevelItem({ name: "Rider's Gear" })).toBe(true);
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
        });
    });
});
