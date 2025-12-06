const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/remove-forgevtt-path-from-token-images.js'), 'utf8');

global.game = {
    actors: []
};

global.console = {
    log: jest.fn()
};

describe("Remove ForgeVTT Path Macro (Token Images)", () => {
    beforeEach(() => {
        global.game.actors = [];
        global.console.log.mockClear();
    });

    test("should log update for actor with ForgeVTT token path and target module", () => {
        const actor = {
            name: 'Test Actor',
            prototypeToken: {
                texture: {
                    src: 'https://assets.forge-vtt.com/bazaar/modules/ose-advancedfantasy/tokens/test.png'
                }
            },
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        const expectedPath = 'modules/ose-advancedfantasy/tokens/test.png';
        expect(global.console.log).toHaveBeenCalledWith(`[Actor: ${actor.name} (Token)] Replace '${actor.prototypeToken.texture.src}' with '${expectedPath}'`);
        // Ensure update is NOT called as it should be commented out
        expect(actor.update).not.toHaveBeenCalled();
    });

    test("should ignore actor with local token path", () => {
        const actor = {
            name: 'Local Actor',
            prototypeToken: {
                texture: {
                    src: 'modules/ose-advancedfantasy/tokens/test.png'
                }
            },
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should ignore actor with different module token path", () => {
        const actor = {
            name: 'Other Module Actor',
            prototypeToken: {
                texture: {
                    src: 'https://assets.forge-vtt.com/bazaar/modules/other-module/tokens/test.png'
                }
            },
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should ignore actor without token image", () => {
        const actor = {
            name: 'No Image Actor',
            prototypeToken: {
                texture: {
                    src: null
                }
            },
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should handle missing prototypeToken safely", () => {
        const actor = {
            name: 'Broken Actor',
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });
});
