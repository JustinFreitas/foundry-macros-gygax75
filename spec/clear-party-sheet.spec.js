const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/clear-party-sheet.js'), 'utf8');

global.game = {
    actors: []
};

global.ui = {
    notifications: {
        info: jest.fn()
    }
};

global.Hooks = {
    call: jest.fn()
};

global.Dialog = jest.fn(function(dialogData) {
    this.render = jest.fn();
    this.data = dialogData;
});

describe("Clear Party Sheet Macro", () => {
    beforeEach(() => {
        game.actors = [];
        ui.notifications.info.mockClear();
        Dialog.mockClear();
        Hooks.call.mockClear();
    });

    test("should notify if the party sheet is already empty", async () => {
        game.actors = [
            { name: 'Actor 1', flags: { ose: { party: false } } },
            { name: 'Actor 2', flags: {} }
        ];

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(ui.notifications.info).toHaveBeenCalledWith("The party sheet is already empty.");
        expect(Dialog).not.toHaveBeenCalled();
        expect(Hooks.call).not.toHaveBeenCalled();
    });

    test("should prompt and remove actors from the party sheet", async () => {
        const actors = [
            {
                name: 'Party Member 1',
                flags: { ose: { party: true } },
                setFlag: jest.fn()
            },
            {
                name: 'Party Member 2',
                flags: { ose: { party: true } },
                setFlag: jest.fn()
            },
            {
                name: 'Non Party Member',
                flags: { ose: { party: false } },
                setFlag: jest.fn()
            }
        ];
        game.actors = actors;

        // Hook into the Dialog constructor to auto-confirm
        let dialogPromise;
        Dialog.mockImplementationOnce(function(dialogData) {
            this.render = jest.fn();
            // Simulate clicking 'yes' and store the promise
            dialogPromise = dialogData.buttons.yes.callback();
        });

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();
        
        // Wait for the callback to finish
        await dialogPromise;
        
        expect(Dialog).toHaveBeenCalled();
        
        // Check that setFlag was called for party members with correct arguments
        expect(actors[0].setFlag).toHaveBeenCalledWith("ose", "party", false);
        expect(actors[1].setFlag).toHaveBeenCalledWith("ose", "party", false);
        
        // Check that setFlag was NOT called for non-party members
        expect(actors[2].setFlag).not.toHaveBeenCalled();

        expect(ui.notifications.info).toHaveBeenCalledWith("Removed 2 actors from the party sheet.");
        expect(Hooks.call).toHaveBeenCalledWith("OSE.Party.showSheet");
    });
});
