const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/character-name-validation.js'), 'utf8');

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

describe("Character Name Validation Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        global.console.log.mockClear();
    });

    // PC Tests
    test("should not log anything for a valid PC name", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log bad format for PC with missing closing parenthesis", () => {
        const actors = [
            { name: 'Alice (Fighter', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Bad Name Format for PC: 'Alice (Fighter'. Expected 'Name (Class)'.");
    });

    test("should log class mismatch for PC", () => {
        const actors = [
            { name: 'Alice (Thief)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for PC 'Alice (Thief)': Name has 'Thief', actor has 'Fighter'.");
    });

    test("should not log anything for a PC name with no class if no parentheses are present", () => {
        const actors = [
            { name: 'Alice', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    // NPC Tests
    test("should not log anything for a valid hired NPC name", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief) (Alice)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
            { name: 'Charlie (Magic-User)(Alice)', type: 'character', flags: {}, system: { details: { class: 'Magic-User' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a valid unhired retainer", () => {
        const actors = [
            { name: 'Bob (Thief)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a valid unhired retainer with empty parentheses", () => {
        const actors = [
            { name: 'Bob (Thief)()', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log class mismatch for a hired NPC", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Magic-User) (Alice)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for NPC 'Bob (Magic-User) (Alice)': Name has 'Magic-User', actor has 'Thief'.");
    });

    test("should log class mismatch for an unhired retainer", () => {
        const actors = [
            { name: 'Bob (Magic-User)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for NPC 'Bob (Magic-User)': Name has 'Magic-User', actor has 'Thief'.");
    });

    test("should log class mismatch for an unhired retainer with empty parentheses", () => {
        const actors = [
            { name: 'Bob (Magic-User)()', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for NPC 'Bob (Magic-User)()': Name has 'Magic-User', actor has 'Thief'.");
    });

    test("should log invalid employer for NPC", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief) (Zelda)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Invalid employer for NPC 'Bob (Thief) (Zelda)': 'Zelda' is not a valid PC.");
    });

    // Special Actor Tests
    test("should not log anything for a valid special actor with class in name", () => {
        const actors = [
            { name: 'Muley (Mule)', type: 'character', flags: {}, system: { details: { class: 'Mule' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a valid special actor with employer in name", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Muley (Alice)', type: 'character', flags: {}, system: { details: { class: 'Mule' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a Riding Horse with a valid NPC rider", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
            { name: 'Horsey (Bob)', type: 'character', flags: {}, system: { details: { class: 'Riding Horse' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a Floating Disc with a valid NPC employer", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
            { name: 'Disc (Bob)', type: 'character', flags: {}, system: { details: { class: 'Floating Disc' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log error for a Mule with invalid content in parentheses", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Muley (Thief)', type: 'character', flags: {}, system: { details: { class: 'Mule' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Invalid content in parentheses for 'Muley (Thief)': 'Thief' is neither a valid employer nor the correct class ('Mule').");
    });

    test("should log error for Riding Horse with invalid content in parentheses", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
            { name: 'Horsey (Zelda)', type: 'character', flags: {}, system: { details: { class: 'Riding Horse' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Invalid content in parentheses for 'Horsey (Zelda)': 'Zelda' is not a valid PC, NPC, or the correct class ('Riding Horse').");
    });

    test("should log error for Floating Disc with invalid content in parentheses", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
            { name: 'Disc (Zelda)', type: 'character', flags: {}, system: { details: { class: 'Floating Disc' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Invalid content in parentheses for 'Disc (Zelda)': 'Zelda' is not a valid PC, NPC, or the correct class ('Floating Disc').");
    });

    // Edge Cases
    test("should handle names with extra spaces correctly", () => {
        const actors = [
            { name: '  Alice   (  Fighter  )  ', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (  Thief  )  (  Alice  )', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should correctly identify PC name for employer check even with class in PC name", () => {
        const actors = [
            { name: 'Player One (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Retainer (Thief) (Player One)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    // Heir asterisk tests
    test("should not log anything for a valid PC name with heir asterisk", () => {
        const actors = [
            { name: 'Alice (Fighter*)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief *)', type: 'character', flags: {}, system: { details: { class: 'Thief' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log class mismatch for PC with heir asterisk", () => {
        const actors = [
            { name: 'Alice (Thief*)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for PC 'Alice (Thief*)': Name has 'Thief', actor has 'Fighter'.");
    });

    test("should not log anything for a valid NPC name with heir asterisk", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Thief*) (Alice)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
            { name: 'Charlie (Magic-User *) (Alice)', type: 'character', flags: {}, system: { details: { class: 'Magic-User' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log class mismatch for NPC with heir asterisk", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (Magic-User*) (Alice)', type: 'character', flags: {}, system: { details: { class: 'Thief' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for NPC 'Bob (Magic-User*) (Alice)': Name has 'Magic-User', actor has 'Thief'.");
    });

    // NH abbreviation tests
    test("should not log anything for a valid PC name with NH abbreviation", () => {
        const actors = [
            { name: 'Alice (NH)', type: 'character', flags: {}, system: { details: { class: 'Normal Human' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should not log anything for a valid NPC name with NH abbreviation", () => {
        const actors = [
            { name: 'Alice (Fighter)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
            { name: 'Bob (NH) (Alice)', type: 'character', flags: {}, system: { details: { class: 'Normal Human' }, retainer: { enabled: true } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).not.toHaveBeenCalled();
    });

    test("should log class mismatch for PC with NH abbreviation", () => {
        const actors = [
            { name: 'Alice (NH)', type: 'character', flags: {}, system: { details: { class: 'Fighter' } } },
        ];
        game.actors.set(actors);
        eval(macroScript);
        expect(global.console.log).toHaveBeenCalledWith("Class mismatch for PC 'Alice (NH)': Name has 'Normal Human', actor has 'Fighter'.");
    });
});
