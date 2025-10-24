const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/duty-xp-bonuses.js'), 'utf8');

global.game = {
    users: {
        _data: [],
        filter: jest.fn(function(filterFn) {
            return this._data.filter(filterFn);
        }),
        forEach: jest.fn(function(callback) {
            this._data.forEach(callback);
        }),
        set: jest.fn(function(users) {
            this._data = users;
        })
    },
    actors: {
        _data: [],
        filter: jest.fn(function(filterFn) {
            return this._data.filter(filterFn);
        }),
        set: jest.fn(function(actors) {
            this._data = actors.map(actorData => {
                let actor = {
                    ...actorData,
                    update: jest.fn()
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

global.document = {
    getElementById: jest.fn((id) => {
        if (id === 'request-user-select') {
            return { value: '1', options: [{ text: 'Player1' }] };
        }
        if (id === 'caller-user-select') {
            return { value: '2', options: [{ text: 'Player2' }] };
        }
        if (id === 'mapper-user-select') {
            return { value: '3', options: [{ text: 'Player3' }] };
        }
        return null;
    })
};

global.Dialog = jest.fn(function(dialogData) {
    this.render = jest.fn();
    dialogData.buttons.calculate.callback();
});

describe("Duty XP Bonuses Macro", () => {

    beforeEach(() => {
        game.users.set([]);
        game.actors.set([]);
        ChatMessage.clear();
    });

    test("should apply XP bonuses to selected users' actors", () => {
        const users = [
            { id: '1', name: 'Player1', hasPlayerOwner: true, active: true },
            { id: '2', name: 'Player2', hasPlayerOwner: true, active: true },
            { id: '3', name: 'Player3', hasPlayerOwner: true, active: true },
        ];
        game.users.set(users);

        const actorsData = [
            {
                name: 'Alice',
                ownership: { '1': 3 },
                flags: { ose: { party: true } },
                system: { details: { xp: { bonus: 0 } } }
            },
            {
                name: 'Bob',
                ownership: { '2': 3 },
                flags: { ose: { party: true } },
                system: { details: { xp: { bonus: 5 } } }
            },
        ];
        game.actors.set(actorsData);
        const actors = game.actors._data;


        eval(macroScript);

        expect(actors[0].update).toHaveBeenCalled();
        expect(actors[1].update).toHaveBeenCalled();

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('<b>Alice:</b> XP bonus updated from 0 to 5 for duty request.');
        expect(messages[0].content).toContain('<b>Bob:</b> XP bonus updated from 5 to 10 for duty caller.');
    });
});
