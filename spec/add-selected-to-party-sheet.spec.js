global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/add-selected-to-party-sheet.js'), 'utf8');

global.canvas = {
    tokens: {
        controlled: []
    }
};

global.ui = {
    notifications: {
        warn: jest.fn(),
        info: jest.fn()
    }
};

global.Hooks = {
    call: jest.fn()
};

global.Actor = {
    updateDocuments: jest.fn()
};

describe("Add Selected to Party Sheet Macro", () => {
    beforeEach(() => {
        canvas.tokens.controlled = [];
        ui.notifications.warn.mockClear();
        ui.notifications.info.mockClear();
        Hooks.call.mockClear();
        Actor.updateDocuments.mockClear();
    });

    test("should warn if no tokens are selected", async () => {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(ui.notifications.warn).toHaveBeenCalledWith("No tokens selected. Please select one or more character tokens.");
        expect(Hooks.call).not.toHaveBeenCalled();
    });

    test("should warn if no character actors are selected", async () => {
        canvas.tokens.controlled = [
            { actor: { name: 'Monster 1', type: 'monster' } },
            { actor: null }
        ];

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(ui.notifications.warn).toHaveBeenCalledWith("No character actors selected.");
        expect(Hooks.call).not.toHaveBeenCalled();
    });

    test("should inform if all selected characters are already in the party sheet", async () => {
        canvas.tokens.controlled = [
            { actor: { name: 'Char 1', type: 'character', flags: { ose: { party: true } } } }
        ];

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(ui.notifications.info).toHaveBeenCalledWith("All selected characters are already in the party sheet.");
        expect(Hooks.call).not.toHaveBeenCalled();
    });

    test("should add selected character actors to the party sheet and refresh the sheet", async () => {
        const actor1 = {
            id: 'actor1',
            name: 'Char 1',
            type: 'character',
            flags: { ose: {} }
        };
        const actor2 = {
            id: 'actor2',
            name: 'Char 2',
            type: 'character',
            flags: { ose: { party: true } }
        };
        const actor3 = {
            id: 'actor3',
            name: 'Char 3',
            type: 'character',
            flags: {}
        };
        // Duplicate token for actor1 to check de-duplication
        canvas.tokens.controlled = [
            { actor: actor1 },
            { actor: actor2 },
            { actor: actor3 },
            { actor: actor1 }
        ];

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(Actor.updateDocuments).toHaveBeenCalledWith([
            { _id: "actor1", "flags.ose.party": true },
            { _id: "actor3", "flags.ose.party": true }
        ]);

        expect(ui.notifications.info).toHaveBeenCalledWith("Added 2 character(s) to the party sheet: Char 1, Char 3");
        expect(Hooks.call).toHaveBeenCalledWith("OSE.Party.showSheet");
    });
});
