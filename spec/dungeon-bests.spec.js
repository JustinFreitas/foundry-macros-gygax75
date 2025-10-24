const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/dungeon-bests.js'), 'utf8');

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

Object.getPrototypeOf(new Map().keys()).toArray = function() {
    return Array.from(this);
};

describe("Dungeon Bests Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        ChatMessage.clear();
    });

    test("should report 'No party members' if there are no party members", () => {
        eval(macroScript);
        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('No party members to check for best abilities.');
    });

    test("should correctly report the best stats for a simple party", () => {
        const actors = [
            { name: 'Alice', flags: { ose: { party: true } }, system: { details: { class: 'Fighter' }, exploration: { ld: 3, od: 2, sd: 1, ft: 1 } } },
            { name: 'Bob', flags: { ose: { party: true } }, system: { details: { class: 'Cleric' }, exploration: { ld: 1, od: 3, sd: 2, ft: 1 } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        const content = messages[0].content;

        expect(content).toContain('<b>Listen Doors:</b> 3 - Alice');
        expect(content).toContain('<b>Open Doors:</b> 3 - Bob');
        expect(content).toContain('<b>Secret Doors:</b> 2 - Bob');
        expect(content).toContain('<b>Find Traps:</b> 1 - Alice, Bob');
    });

    test("should ignore non-party members and mules", () => {
        const actors = [
            { name: 'Alice', flags: { ose: { party: true } }, system: { details: { class: 'Fighter' }, exploration: { ld: 3, od: 2, sd: 1, ft: 1 } } },
            { name: 'Mule', flags: { ose: { party: true } }, system: { details: { class: 'Mule' }, exploration: { ld: 9, od: 9, sd: 9, ft: 9 } } },
            { name: 'NonParty', flags: { ose: { party: false } }, system: { details: { class: 'Thief' }, exploration: { ld: 9, od: 9, sd: 9, ft: 9 } } },
        ];
        game.actors.set(actors);

        eval(macroScript);

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        const content = messages[0].content;

        expect(content).toContain('<b>Listen Doors:</b> 3 - Alice');
        expect(content).not.toContain('Mule');
        expect(content).not.toContain('NonParty');
    });
});