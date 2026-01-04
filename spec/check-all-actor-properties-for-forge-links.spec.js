const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/check-all-actor-properties-for-forge-links.js'), 'utf8');

global.game = {
    actors: []
};

global.console = {
    log: jest.fn()
};

describe("Check All Actor Properties Macro", () => {
    beforeEach(() => {
        global.game.actors = [];
        global.console.log.mockClear();
    });



    test("should find and list update for systems/ path", () => {
        const actor = {
            name: 'System Actor',
            toObject: () => ({
                img: 'https://assets.forge-vtt.com/bazaar/systems/dnd5e/icons/sword.png', // Update target
                system: {
                    details: {
                        biography: 'Some text'
                    }
                }
            }),
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        const expectedNewPath = 'systems/dnd5e/icons/sword.png';
        // The macro now expands the update object, but 'img' is top level so it looks the same.
        // Wait, if it was system.details.biography it would change.
        // 'img' stays { "img": ... }
        const expectedUpdate = { "img": expectedNewPath };

        expect(global.console.log).toHaveBeenCalledWith(`[Actor: System Actor] Replace 'https://assets.forge-vtt.com/bazaar/systems/dnd5e/icons/sword.png' with '${expectedNewPath}' at 'img'`);
        expect(global.console.log).toHaveBeenCalledWith(`Updates for System Actor:`, JSON.stringify(expectedUpdate, null, 2));
    });

    test("should expand nested updates", () => {
        const actor = {
            name: 'Nested Actor',
            toObject: () => ({
                system: {
                    details: {
                        notes: 'https://assets.forge-vtt.com/bazaar/systems/note.png'
                    }
                }
            }),
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        const expectedNewPath = 'systems/note.png';
        const expectedUpdate = {
            "system": {
                "details": {
                    "notes": expectedNewPath
                }
            }
        };

        expect(global.console.log).toHaveBeenCalledWith(`[Actor: Nested Actor] Replace 'https://assets.forge-vtt.com/bazaar/systems/note.png' with '${expectedNewPath}' at 'system.details.notes'`);
        expect(global.console.log).toHaveBeenCalledWith(`Updates for Nested Actor:`, JSON.stringify(expectedUpdate, null, 2));
    });

    test("should find nested ForgeVTT URL (non-system)", () => {
        const strictActor = {
            name: 'Strict Actor',
            toObject: () => ({
                img: 'https://assets.forge-vtt.com/token.png', // Match, no update
                system: {
                    details: {
                        biography: '<p>Content</p>' // No match
                    },
                    notes: 'https://assets.forge-vtt.com/note.pdf', // Match, no update
                }
            }),
            update: jest.fn()
        };
        global.game.actors = [strictActor];

        eval(macroScript);

        expect(global.console.log).toHaveBeenCalledWith(`[Actor: Strict Actor] Found other Forge URL at 'img': 'https://assets.forge-vtt.com/token.png'`);
        expect(global.console.log).toHaveBeenCalledWith(`[Actor: Strict Actor] Found other Forge URL at 'system.notes': 'https://assets.forge-vtt.com/note.pdf'`);
        expect(strictActor.update).not.toHaveBeenCalled();
    });

    test("should handle actor without toObject method (mock fallback)", () => {
        const actor = {
            name: 'Simple Actor',
            img: 'https://assets.forge-vtt.com/simple.png'
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).toHaveBeenCalledWith(`[Actor: Simple Actor] Found other Forge URL at 'img': 'https://assets.forge-vtt.com/simple.png'`);
    });
});
