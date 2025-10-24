const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/duty-xp-reset.js'), 'utf8');

global.game = {
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

describe("Duty XP Reset Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        ChatMessage.clear();
    });

    test("should reset XP bonus for actors with dutyXP flag", () => {
        const actorsData = [
            {
                name: 'Alice',
                flags: {
                    dutyXP: {
                        origXpBonus: 5,
                        duties: ['request']
                    }
                },
                system: {
                    details: {
                        xp: {
                            bonus: 10
                        }
                    }
                }
            },
            {
                name: 'Bob',
                flags: {},
                system: {
                    details: {
                        xp: {
                            bonus: 5
                        }
                    }
                }
            }
        ];
        game.actors.set(actorsData);
        const actors = game.actors._data;

        eval(macroScript);

        expect(actors[0].update).toHaveBeenCalledWith({
            'flags.-=dutyXP': null,
            system: {
                details: {
                    xp: {
                        bonus: 5
                    }
                }
            }
        });
        expect(actors[1].update).not.toHaveBeenCalled();

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('<b>Alice:</b> had their XP reset from 10 back to the original of 5 for duty request.');
    });
});
