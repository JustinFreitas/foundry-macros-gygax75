const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/character-upkeep.js'), 'utf8');

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
                    items: {
                        _data: actorData.items || [],
                        filter: function(filterFn) {
                            return this._data.filter(filterFn);
                        },
                        get: function(id) {
                            return this._data.find(item => item.id === id);
                        },
                        map: function(mapFn) {
                            return this._data.map(mapFn);
                        },
                        getName: function(name) {
                            return this._data.find(item => item.name === name);
                        }
                    },
                    update: async function(data) {
                        this.system.hp.value = data.system.hp.value;
                        return this;
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

global.$ = (x) => x;
global.Dialog = jest.fn().mockImplementation(function(dialogData) {
    const promise = new Promise(async (resolve, reject) => {
        const html = {
            find: (selector) => {
                if (selector === 'input.character') {
                    return [{value: '10'}];
                }
                if (selector === 'input.heal') {
                    return [{value: '5'}];
                }
                return [];
            }
        };
        await dialogData.buttons.find(b => b.action === "calculate").callback(null, null, { element: html });
        resolve();
    });
    const instance = {
        render: jest.fn(),
        getPromise: () => promise
    };
    global.Dialog.mostRecentInstance = instance;
    return instance;
});
global.foundry = { applications: { api: { DialogV2: global.Dialog } } };

global.document = {
    getElementById: (id) => null
};

describe("Character Upkeep Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        ChatMessage.clear();
    });

    test("should deduct upkeep and apply healing to a character", async () => {
        const actors = [
            {
                name: 'Alice (Fighter)',
                type: 'character',
                flags: { ose: { party: true } },
                system: {
                    hp: { value: 10, max: 20 },
                    details: { class: 'Fighter' },
                    retainer: { enabled: false }
                },
                items: [
                    {
                        name: 'GP (Bank)',
                        type: 'item',
                        system: {
                            quantity: { value: 100 }
                        },
                        update: async function(data) {
                            this.system.quantity.value = data.system.quantity.value;
                            return this;
                        }
                    }
                ]
            }
        ];
        game.actors.set(actors);

        eval(macroScript);

        await global.Dialog.mostRecentInstance.getPromise();

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('healed to 15/20');
        expect(messages[0].content).toContain('Cost of living <b>10gp</b>');
        expect(messages[0].content).toContain('Bank balance changed from 100gp to 90gp');
    });

    test("should not corrupt the bank when upkeep input is non-numeric", async () => {
        // Feed garbage into the upkeep field. Before the fix, "+'abc'" produced NaN
        // and was written straight into the bank quantity.
        global.$ = (x) => x;
global.Dialog = jest.fn().mockImplementation(function(dialogData) {
            const promise = new Promise(async (resolve) => {
                const html = {
                    find: (selector) => {
                        if (selector === 'input.character') return [{ value: 'abc' }];
                        if (selector === 'input.heal') return [{ value: '0' }];
                        return [];
                    }
                };
                await dialogData.buttons.find(b => b.action === "calculate").callback(null, null, { element: html });
                resolve();
            });
            const instance = { render: jest.fn(), getPromise: () => promise };
            global.Dialog.mostRecentInstance = instance;
            return instance;
        });
global.foundry = { applications: { api: { DialogV2: global.Dialog } } };

        const bankItem = {
            name: 'GP (Bank)',
            type: 'item',
            system: { quantity: { value: 100 } },
            update: jest.fn(async function (data) {
                this.system.quantity.value = data.system.quantity.value;
                return this;
            })
        };

        const actors = [
            {
                name: 'Bob (Fighter)',
                type: 'character',
                flags: { ose: { party: true } },
                system: {
                    hp: { value: 20, max: 20 },
                    details: { class: 'Fighter' },
                    retainer: { enabled: false }
                },
                items: [bankItem]
            }
        ];
        game.actors.set(actors);

        eval(macroScript);
        await global.Dialog.mostRecentInstance.getPromise();

        // Bank untouched; NaN never reaches the ledger.
        expect(bankItem.update).not.toHaveBeenCalled();
        expect(bankItem.system.quantity.value).toBe(100);

        const messages = ChatMessage.getCreated();
        expect(messages[0].content).toContain('No Downtime Cost');
    });

    test("should treat negative upkeep input as No Downtime Cost", async () => {
        global.$ = (x) => x;
global.Dialog = jest.fn().mockImplementation(function(dialogData) {
            const promise = new Promise(async (resolve) => {
                const html = {
                    find: (selector) => {
                        if (selector === 'input.character') return [{ value: '-50' }];
                        if (selector === 'input.heal') return [{ value: '0' }];
                        return [];
                    }
                };
                await dialogData.buttons.find(b => b.action === "calculate").callback(null, null, { element: html });
                resolve();
            });
            const instance = { render: jest.fn(), getPromise: () => promise };
            global.Dialog.mostRecentInstance = instance;
            return instance;
        });
global.foundry = { applications: { api: { DialogV2: global.Dialog } } };

        const bankItem = {
            name: 'GP (Bank)',
            type: 'item',
            system: { quantity: { value: 100 } },
            update: jest.fn()
        };

        game.actors.set([
            {
                name: 'Carol (Cleric)',
                type: 'character',
                flags: { ose: { party: true } },
                system: {
                    hp: { value: 20, max: 20 },
                    details: { class: 'Cleric' },
                    retainer: { enabled: false }
                },
                items: [bankItem]
            }
        ]);

        eval(macroScript);
        await global.Dialog.mostRecentInstance.getPromise();

        expect(bankItem.update).not.toHaveBeenCalled();
        expect(ChatMessage.getCreated()[0].content).toContain('No Downtime Cost');
    });
});
