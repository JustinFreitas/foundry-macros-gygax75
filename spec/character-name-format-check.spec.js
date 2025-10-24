const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/character-name-format-check.js'), 'utf8');

global.game = {
    actors: {
        _data: [],
        filter: jest.fn(function(filterFn) {
            return this._data.filter(filterFn);
        }),
        set: jest.fn(function(actors) {
            this._data = actors;
        })
    }
};

global.console = {
    log: jest.fn()
};

describe("Character Name Format Check Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        global.console.log.mockClear();
    });

    test("should not log anything for a valid character name", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', hasPlayerOwner: true, flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log 'Bad Name' for a name without a class", () => {
        const actors = [
            { name: 'Alice', type: 'character', hasPlayerOwner: true, flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        expect(global.console.log).toHaveBeenCalledWith("Bad Name: 'Alice'");
    });

    test("should log 'Bad Name' for a retainer without an employer", () => {
        const actors = [
            { name: 'Bob (Fighter)', type: 'character', hasPlayerOwner: true, flags: {}, system: { details: { class: 'Fighter' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        expect(global.console.log).toHaveBeenCalledWith("Bad Name: 'Bob (Fighter)'");
    });

    test("should not log anything for a valid retainer name", () => {
        const actors = [
            { name: 'Bob (Fighter)(Alice)', type: 'character', hasPlayerOwner: true, flags: {}, system: { details: { class: 'Fighter' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a valid mount name", () => {
        const actors = [
            { name: 'Muley (Mule)', type: 'character', hasPlayerOwner: true, flags: {}, system: { details: { class: 'Mule' } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        expect(global.console.log).not.toHaveBeenCalled();
    });
});
