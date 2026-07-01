global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/remove-forgevtt-path-from-actor-images.js'), 'utf8');

global.game = {
    actors: []
};

global.console = {
    log: jest.fn()
};

describe("Remove ForgeVTT Path Macro", () => {
    beforeEach(() => {
        global.game.actors = [];
        global.console.log.mockClear();
    });

    test("should log update for actor with ForgeVTT path and target module", () => {
        const actor = {
            name: 'Test Actor',
            img: 'https://assets.forge-vtt.com/bazaar/modules/justins-gygax-75-module/tokens/test.png',
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        const expectedPath = 'modules/justins-gygax-75-module/tokens/test.png';
        expect(global.console.log).toHaveBeenCalledWith(`[Actor: ${actor.name}] Replace '${actor.img}' with '${expectedPath}'`);
        // Ensure update is NOT called as it should be commented out
        expect(actor.update).not.toHaveBeenCalled();
    });

    test("should ignore actor with local path", () => {
        const actor = {
            name: 'Local Actor',
            img: 'modules/justins-gygax-75-module/tokens/test.png',
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should ignore actor with different module", () => {
        const actor = {
            name: 'Other Module Actor',
            img: 'https://assets.forge-vtt.com/bazaar/modules/other-module/tokens/test.png',
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should ignore actor without image", () => {
        const actor = {
            name: 'No Image Actor',
            img: null,
            update: jest.fn()
        };
        global.game.actors = [actor];

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });
});
