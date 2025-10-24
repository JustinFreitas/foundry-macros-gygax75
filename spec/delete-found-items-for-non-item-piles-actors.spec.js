const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/delete-found-items-for-non-item-piles-actors.js'), 'utf8');

global.canvas = {
    tokens: {
        controlled: []
    }
};

global.ui = {
    notifications: {
        info: jest.fn()
    }
};

global.ChatMessage = {
    _created: [],
    create: jest.fn(function(message) {
        this._created.push(message);
    }),
    getCreated: jest.fn(function() {
        return this._created;
    }),
    clear: jest.fn(function() {
        this._created = [];
    })
};

global.Dialog = jest.fn(function(dialogData) {
    this.render = jest.fn();
    dialogData.buttons.yes.callback();
});

describe("Delete Found Items Macro", () => {

    beforeEach(() => {
        canvas.tokens.controlled = [];
        ChatMessage.clear();
        ui.notifications.info.mockClear();
    });

    test("should delete found items from selected actors", async () => {
        const actors = [
            {
                name: 'Alice',
                flags: {},
                items: {
                    _data: [
                        { id: '1', name: 'Sword (Found)' },
                        { id: '2', name: 'Shield' },
                    ],
                    filter: function(filterFn) {
                        return this._data.filter(filterFn);
                    },
                    map: function(mapFn) {
                        return this._data.map(mapFn);
                    }
                },
                deleteEmbeddedDocuments: jest.fn()
            }
        ];
        canvas.tokens.controlled = actors.map(a => ({ actor: a }));

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(actors[0].deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ['1']);
        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('<b>Alice:</b> Sword (Found)');
    });

    test("should not delete items from item pile actors", async () => {
        const actors = [
            {
                name: 'Alice',
                flags: { "item-piles": { data: { enabled: true } } },
                items: {
                    _data: [
                        { id: '1', name: 'Sword (Found)' },
                    ],
                    filter: function(filterFn) {
                        return this._data.filter(filterFn);
                    }
                },
                deleteEmbeddedDocuments: jest.fn()
            }
        ];
        canvas.tokens.controlled = actors.map(a => ({ actor: a }));

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const scriptFunction = new AsyncFunction(macroScript);
        await scriptFunction();

        expect(actors[0].deleteEmbeddedDocuments).not.toHaveBeenCalled();
        expect(ui.notifications.info).toHaveBeenCalledWith("No actors selected or none of the selected actors have item piles disabled.");
    });
});
