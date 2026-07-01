global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroFile = path.resolve(__dirname, '../scripts/check-all-actor-properties-for-forge-links.js');
const macroScript = fs.readFileSync(macroFile, 'utf8');

const createCollectionMock = (data = []) => ({
    _data: data,
    filter: function(fn) { return this._data.filter(fn); },
    forEach: function(fn) { return this._data.forEach(fn); },
    get: function(id) { return this._data.find(a => a.id === id); },
    mockReturnValue: function(val) { this._data = val; return this; }
});

global.game = {
    actors: createCollectionMock(),
    items: createCollectionMock()
};

global.console = {
    log: jest.fn()
};

global.foundry = {
    utils: {
        expandObject: (obj) => {
            const expanded = {};
            for (const [key, value] of Object.entries(obj)) {
                let current = expanded;
                const parts = key.split('.');
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (i === parts.length - 1) {
                        current[part] = value;
                    } else {
                        current[part] = current[part] || {};
                        current = current[part];
                    }
                }
            }
            return expanded;
        }
    }
};

describe("Check All Actor Properties Macro", () => {
    beforeEach(() => {
        global.game.actors._data = [];
        global.game.items._data = [];
        global.console.log.mockClear();
        jest.resetModules();
    });

    const runMacro = () => {
        // Wrap in IIFE to allow re-declaring const/let
        eval(`(function() { ${macroScript} })();`);
    };

    test("should find and list update for systems/ path", () => {
        const actor = {
            name: 'System Actor',
            toObject: () => ({
                img: 'https://assets.forge-vtt.com/systems/dnd5e/icons/sword.png', 
                system: {
                    details: {
                        biography: 'Some text'
                    }
                }
            }),
            update: jest.fn()
        };
        global.game.actors._data = [actor];

        runMacro();

        expect(global.console.log).toHaveBeenCalledWith(expect.stringContaining("Replace 'https://assets.forge-vtt.com/systems/dnd5e/icons/sword.png'"));
        expect(actor.update).toHaveBeenCalled();
    });

    test("should expand nested updates", () => {
        const actor = {
            name: 'Nested Actor',
            toObject: () => ({
                system: {
                    details: {
                        notes: 'https://assets.forge-vtt.com/systems/note.png'
                    }
                }
            }),
            update: jest.fn()
        };
        global.game.actors._data = [actor];

        runMacro();

        expect(global.console.log).toHaveBeenCalledWith(expect.stringContaining("Replace 'https://assets.forge-vtt.com/systems/note.png'"));
        expect(actor.update).toHaveBeenCalled();
    });

    test("should find nested ForgeVTT URL (non-system)", () => {
        const actor = {
            name: 'Strict Actor',
            toObject: () => ({
                img: 'https://assets.forge-vtt.com/token.png', 
                system: {
                    details: {
                        biography: '<p>Content</p>' 
                    },
                    notes: 'https://assets.forge-vtt.com/note.pdf', 
                }
            }),
            update: jest.fn()
        };
        global.game.actors._data = [actor];

        runMacro();

        expect(global.console.log).toHaveBeenCalledWith(expect.stringContaining("Found other Forge URL at 'img'"));
        expect(actor.update).not.toHaveBeenCalled();
    });

    test("should handle actor without toObject method (mock fallback)", () => {
        const actor = {
            name: 'Simple Actor',
            img: 'https://assets.forge-vtt.com/simple.png'
        };
        global.game.actors._data = [actor];

        runMacro();

        expect(global.console.log).toHaveBeenCalledWith(expect.stringContaining("Found other Forge URL at 'img'"));
    });
});
