const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/clear-item-pile.js'), 'utf8');

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

global.Dialog = jest.fn(function(dialogData) {
    this.render = jest.fn();
    this.data = dialogData; 
});

describe("Clear Item Pile Macro", () => {
    beforeEach(() => {
        canvas.tokens.controlled = [];
        ui.notifications.warn.mockClear();
        ui.notifications.info.mockClear();
        Dialog.mockClear();
    });

    test("should warn if no tokens are selected", async () => {
        canvas.tokens.controlled = [];

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(ui.notifications.warn).toHaveBeenCalledWith("No tokens selected. Please select at least one Item Pile token.");
        expect(Dialog).not.toHaveBeenCalled();
    });

    test("should warn if selected tokens are not Item Piles", async () => {
        const actors = [
            {
                name: 'Not A Pile',
                flags: {}, // No item-piles flag
                items: []
            }
        ];
        canvas.tokens.controlled = actors.map(a => ({ actor: a }));

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(ui.notifications.warn).toHaveBeenCalledWith("No Item Pile actors selected.");
        expect(Dialog).not.toHaveBeenCalled();
    });

    test("should prompt and clear items from Item Pile actors", async () => {
        const actors = [
            {
                name: 'Pile 1',
                flags: { "item-piles": { data: { enabled: true } } },
                items: [
                    { id: 'item1', name: 'Sword' },
                    { id: 'item2', name: 'Shield' }
                ],
                deleteEmbeddedDocuments: jest.fn()
            },
            {
                name: 'Pile 2',
                flags: { "item-piles": { data: { enabled: true } } },
                items: [], // Empty pile
                deleteEmbeddedDocuments: jest.fn()
            }
        ];
        canvas.tokens.controlled = actors.map(a => ({ actor: a }));

        // Hook into the Dialog constructor to auto-confirm
        Dialog.mockImplementationOnce(function(dialogData) {
            this.render = jest.fn();
            // Simulate clicking 'yes'
            dialogData.buttons.yes.callback();
        });

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(Dialog).toHaveBeenCalled();
        
        // First actor has items, should call delete
        expect(actors[0].deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ['item1', 'item2']);
        
        // Second actor has no items, should NOT call delete
        expect(actors[1].deleteEmbeddedDocuments).not.toHaveBeenCalled();

        expect(ui.notifications.info).toHaveBeenCalledWith("Cleared items from 1 Item Pile(s).");
    });
});
