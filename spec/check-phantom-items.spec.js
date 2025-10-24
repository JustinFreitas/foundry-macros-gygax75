const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/check-phantom-items.js'), 'utf8');

global.game = {
    actors: {
        _data: [],
        forEach: jest.fn(function(callback) {
            this._data.forEach(callback);
        }),
        set: jest.fn(function(actors) {
            this._data = actors.map(actorData => {
                let actor = {
                    ...actorData,
                    items: {
                        _data: actorData.items || [],
                        filter: function(filterFn) {
                            return this._data.filter(filterFn);
                        },
                        get: function(id) {
                            return this._data.find(item => item.id === id);
                        },
                        forEach: function(callback) {
                            this._data.forEach(callback);
                        }
                    }
                };
                return actor;
            });
        })
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

describe("Check Phantom Items Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        ChatMessage.clear();
    });

    test("should report 'No phantom items found' if there are no phantom items", () => {
        const actors = [
            {
                name: 'Alice',
                items: [
                    { id: '1', name: 'Item 1', type: 'item', system: { containerId: '' } },
                    { id: '2', name: 'Item 2', type: 'item', system: { containerId: '1' } },
                ]
            }
        ];
        game.actors.set(actors);

        eval(macroScript);

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('No phantom items found.');
    });

    test("should report phantom items", () => {
        const actors = [
            {
                name: 'Alice',
                items: [
                    { id: '1', name: 'Item 1', type: 'item', system: { containerId: '' } },
                    { id: '2', name: 'Item 2', type: 'item', system: { containerId: '3' } },
                ]
            }
        ];
        game.actors.set(actors);

        eval(macroScript);

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('<b>Alice:</b> Item 2<br/>');
    });
});
