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

global.$ = (x) => x;

class MockDialogV2 {
    static instances = [];
    static onConstruct = null;

    constructor(dialogData) {
        this.data = dialogData;
        this.config = dialogData;
        this.render = jest.fn();
        this.addEventListener = jest.fn();
        MockDialogV2.instances.push(this);
        if (MockDialogV2.onConstruct) MockDialogV2.onConstruct(this);
    }
}

global.Dialog = MockDialogV2;
global.foundry = { applications: { api: { DialogV2: MockDialogV2 } } };

describe("Clear Party Sheet Macro", () => {
    beforeEach(() => {
        game.actors = [];
        ui.notifications.info.mockClear();
        MockDialogV2.instances = [];
        MockDialogV2.onConstruct = null;
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
        expect(MockDialogV2.instances.length).toBe(0);
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
        MockDialogV2.onConstruct = (dlg) => {
            dialogPromise = dlg.config.buttons.find(b => b.action === "yes").callback(null, null, { element: document.createElement("div") });
        };

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();
        
        // Wait for the callback to finish
        await dialogPromise;
        
        expect(MockDialogV2.instances.length).toBe(1);
        
        // Check that setFlag was called for party members with correct arguments
        expect(actors[0].setFlag).toHaveBeenCalledWith("ose", "party", false);
        expect(actors[0].setFlag).toHaveBeenCalledWith("ose", "-=marchingOrder", null);
        expect(actors[1].setFlag).toHaveBeenCalledWith("ose", "party", false);
        expect(actors[1].setFlag).toHaveBeenCalledWith("ose", "-=marchingOrder", null);
        
        // Check that setFlag was NOT called for non-party members
        expect(actors[2].setFlag).not.toHaveBeenCalled();

        expect(ui.notifications.info).toHaveBeenCalledWith("Removed 2 actors from the party sheet.");
        expect(Hooks.call).toHaveBeenCalledWith("OSE.Party.showSheet");
    });
});
