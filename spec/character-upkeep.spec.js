const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/character-upkeep.js'), 'utf8');
const sheetFixture = fs.readFileSync(path.resolve(__dirname, 'fixtures/characters-in-world.tsv'), 'utf8');

global.game = {
    actors: {
        _data: [],
        filter: jest.fn(function(filterFn) {
            return this._data.filter(filterFn);
        }),
        get: jest.fn(function(id) {
            return this._data.find(actor => actor.id === id);
        }),
        set: jest.fn(function(actors) {
            this._data = actors.map((actorData, index) => {
                let actor = {
                    id: actorData.id || `actor-${index}`,
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

// Stands in for DialogV2. The real class injects options.content into the DOM and emits a
// "render" event once it exists; reproduce both so the macro's listener wiring is exercised.
function installDialogMock() {
    const DialogV2 = jest.fn().mockImplementation(function(config) {
        const listeners = {};
        const element = document.createElement('div');
        element.innerHTML = config.content.innerHTML;

        const instance = {
            config,
            element,
            render: jest.fn(),
            addEventListener: jest.fn(function(eventName, handler) {
                listeners[eventName] = handler;
            }),
            fireRender() {
                listeners.render({ target: instance });
            },
            pasteSheetData(text) {
                const textarea = element.querySelector('#sheet-data');
                const event = new Event('paste', { bubbles: true, cancelable: true });
                event.clipboardData = { getData: () => text };
                textarea.dispatchEvent(event);
            },
            row(actorName) {
                return Array.from(element.querySelectorAll('.upkeep-row'))
                    .find(r => r.querySelector('.actor-name').textContent.includes(actorName));
            },
            setInputs(actorName, upkeep, heal) {
                const row = instance.row(actorName);
                row.querySelector('input.character').value = String(upkeep);
                row.querySelector('input.heal').value = String(heal);
            },
            processUpkeep() {
                return config.buttons.find(b => b.action === 'calculate').callback(null, null, instance);
            }
        };
        global.lastDialog = instance;
        return instance;
    });
    global.foundry = { applications: { api: { DialogV2 } } };
}

const bankLedger = (value) => ({
    name: 'GP (Bank)',
    type: 'item',
    system: { quantity: { value } },
    update: jest.fn(async function(data) {
        this.system.quantity.value = data.system.quantity.value;
        return this;
    })
});

const pc = (id, name, overrides = {}) => ({
    id,
    name,
    type: 'character',
    flags: { ose: { party: true } },
    system: {
        hp: { value: 10, max: 20 },
        details: { class: 'Fighter' },
        retainer: { enabled: false },
        ...(overrides.system || {})
    },
    items: overrides.items || []
});

describe("Character Upkeep Macro", () => {

    beforeEach(() => {
        game.actors.set([]);
        ChatMessage.clear();
        document.body.innerHTML = '';
        installDialogMock();
    });

    test("should deduct upkeep and apply healing to a character", async () => {
        game.actors.set([
            pc('a1', 'Alice (Fighter)', { items: [bankLedger(100)] })
        ]);

        eval(macroScript);
        lastDialog.setInputs('Alice', 10, 5);
        await lastDialog.processUpkeep();

        const messages = ChatMessage.getCreated();
        expect(messages.length).toBe(1);
        expect(messages[0].content).toContain('healed to 15/20');
        expect(messages[0].content).toContain('Cost of living <b>10gp</b>');
        expect(messages[0].content).toContain('Bank balance changed from 100gp to 90gp');
    });

    test("should not corrupt the bank when upkeep input is non-numeric", async () => {
        // Feed garbage into the upkeep field. Before the fix, "+'abc'" produced NaN
        // and was written straight into the bank quantity.
        const bankItem = bankLedger(100);
        game.actors.set([
            pc('b1', 'Bob (Fighter)', {
                items: [bankItem],
                system: { hp: { value: 20, max: 20 }, details: { class: 'Fighter' }, retainer: { enabled: false } }
            })
        ]);

        eval(macroScript);
        lastDialog.setInputs('Bob', 'abc', 0);
        await lastDialog.processUpkeep();

        // Bank untouched; NaN never reaches the ledger.
        expect(bankItem.update).not.toHaveBeenCalled();
        expect(bankItem.system.quantity.value).toBe(100);
        expect(ChatMessage.getCreated()[0].content).toContain('No Downtime Cost');
    });

    test("should treat negative upkeep input as No Downtime Cost", async () => {
        const bankItem = bankLedger(100);
        game.actors.set([
            pc('c1', 'Carol (Cleric)', {
                items: [bankItem],
                system: { hp: { value: 20, max: 20 }, details: { class: 'Cleric' }, retainer: { enabled: false } }
            })
        ]);

        eval(macroScript);
        lastDialog.setInputs('Carol', -50, 0);
        await lastDialog.processUpkeep();

        expect(bankItem.update).not.toHaveBeenCalled();
        expect(ChatMessage.getCreated()[0].content).toContain('No Downtime Cost');
    });

    describe("spreadsheet paste", () => {

        // Regression guard for the DialogV2 migration: the parsing script used to live in an
        // injected <script> tag with an inline onpaste hook, both of which foundry.utils
        // .cleanHTML() strips out, leaving the paste silently doing nothing.
        test("should populate every row from the pasted sheet", () => {
            game.actors.set([
                pc('a', 'Acandor (Magic User)', { items: [bankLedger(5000)] }),
                pc('g', 'Grimmel (Gnome)', { items: [bankLedger(5000)] }),
                pc('d', 'Devy (Fighter)', { items: [bankLedger(5000)] }),
                pc('r', 'Drune (Magic User)', { items: [bankLedger(5000)] })
            ]);

            eval(macroScript);
            lastDialog.fireRender();
            lastDialog.pasteSheetData(sheetFixture);

            const upkeep = (name) => lastDialog.row(name).querySelector('input.character').value;
            expect(upkeep('Acandor')).toBe('1182.5');
            expect(upkeep('Grimmel')).toBe('554');
            expect(upkeep('Devy')).toBe('2835');
            expect(upkeep('Drune')).toBe('652.5');
        });

        test("should roll the sheet's healing dice into the heal field", () => {
            game.actors.set([pc('a', 'Acandor (Magic User)', { items: [bankLedger(5000)] })]);

            eval(macroScript);
            lastDialog.fireRender();
            lastDialog.pasteSheetData(sheetFixture);

            // Acandor's sheet cell is 214d3, so the roll lands somewhere in [214, 642].
            const heal = Number(lastDialog.row('Acandor').querySelector('input.heal').value);
            expect(heal).toBeGreaterThanOrEqual(214);
            expect(heal).toBeLessThanOrEqual(642);
        });

        test("should keep the pasted text in the textarea", () => {
            game.actors.set([pc('a', 'Acandor (Magic User)', { items: [bankLedger(5000)] })]);

            eval(macroScript);
            lastDialog.fireRender();
            lastDialog.pasteSheetData(sheetFixture);

            expect(lastDialog.element.querySelector('#sheet-data').value).toBe(sheetFixture);
        });

        test("should flag a character who is absent from the sheet", () => {
            game.actors.set([pc('z', 'Zaphod (Thief)', { items: [bankLedger(5000)] })]);

            eval(macroScript);
            lastDialog.fireRender();
            lastDialog.pasteSheetData(sheetFixture);

            const row = lastDialog.row('Zaphod');
            expect(row.querySelector('input.character').value).toBe('');
            expect(row.querySelector('input.character').placeholder).toBe('Not found in sheet');
            expect(row.classList.contains('not-found')).toBe(true);
        });

        // The paste hook survived cleanHTML only because content is passed as an element.
        test("should pass content as an attribute-free div so cleanHTML is bypassed", () => {
            game.actors.set([pc('a', 'Acandor (Magic User)', { items: [bankLedger(5000)] })]);

            eval(macroScript);

            const content = lastDialog.config.content;
            expect(content.tagName).toBe('DIV');
            expect(content.attributes.length).toBe(0);
            expect(content.querySelector('style')).not.toBeNull();
            expect(content.querySelector('#sheet-data').getAttribute('placeholder')).toContain('Paste all Characters');
        });

        test("should pair rows to actors by id rather than position", async () => {
            const aliceBank = bankLedger(1000);
            const bobBank = bankLedger(1000);
            game.actors.set([
                pc('alice', 'Alice (Fighter)', { items: [aliceBank] }),
                pc('bob', 'Bob (Fighter)', { items: [bobBank] })
            ]);

            eval(macroScript);

            const rows = lastDialog.element.querySelectorAll('.upkeep-row');
            expect(rows[0].dataset.actorId).toBe('alice');
            expect(rows[1].dataset.actorId).toBe('bob');

            lastDialog.setInputs('Alice', 100, 0);
            lastDialog.setInputs('Bob', 250, 0);
            await lastDialog.processUpkeep();

            expect(aliceBank.system.quantity.value).toBe(900);
            expect(bobBank.system.quantity.value).toBe(750);
        });
    });

    describe("rounding and overdraft", () => {

        test("should round a half-gold cost up and name the exact sheet figure", async () => {
            const bankItem = bankLedger(4000);
            game.actors.set([pc('a', 'Acandor (Magic User)', { items: [bankItem] })]);

            eval(macroScript);
            lastDialog.setInputs('Acandor', 1182.5, 0);
            await lastDialog.processUpkeep();

            expect(bankItem.system.quantity.value).toBe(2817);
            const content = ChatMessage.getCreated()[0].content;
            expect(content).toContain('Cost of living <b>1183gp</b> (sheet: 1182.5)');
        });

        test("should not annotate a whole-gold cost", async () => {
            const bankItem = bankLedger(4000);
            game.actors.set([pc('g', 'Grimmel (Gnome)', { items: [bankItem] })]);

            eval(macroScript);
            lastDialog.setInputs('Grimmel', 554, 0);
            await lastDialog.processUpkeep();

            expect(ChatMessage.getCreated()[0].content).toContain('Cost of living <b>554gp</b>. Bank');
            expect(ChatMessage.getCreated()[0].content).not.toContain('sheet:');
        });

        // OSE's quantity NumberField has min: 0 and clamps silently, so an unreported
        // overdraft would quietly forgive the debt.
        test("should floor the bank at zero and report the shortfall", async () => {
            const bankItem = bankLedger(500);
            game.actors.set([pc('d', 'Devy (Fighter)', { items: [bankItem] })]);

            eval(macroScript);
            lastDialog.setInputs('Devy', 2835, 0);
            await lastDialog.processUpkeep();

            expect(bankItem.system.quantity.value).toBe(0);
            const content = ChatMessage.getCreated()[0].content;
            expect(content).toContain('Bank emptied from 500gp');
            expect(content).toContain('still short <b>2335gp</b>');
        });
    });

    describe("retainers", () => {

        test("should heal retainers alongside their master", async () => {
            game.actors.set([
                pc('m', 'Acandor (Magic User)', { items: [bankLedger(5000)] }),
                {
                    id: 'ret',
                    name: 'Torch Bearer (Acandor)',
                    type: 'character',
                    flags: { ose: {} },
                    system: {
                        hp: { value: 1, max: 6 },
                        details: { class: 'Fighter' },
                        retainer: { enabled: true }
                    },
                    items: []
                }
            ]);

            eval(macroScript);
            lastDialog.setInputs('Acandor', 100, 5);
            await lastDialog.processUpkeep();

            const content = ChatMessage.getCreated()[0].content;
            expect(content).toContain('<strong>Torch Bearer (Acandor)</strong> healed to 6/6');
        });

        test("should not build a row for a retainer", () => {
            game.actors.set([
                pc('m', 'Acandor (Magic User)', { items: [bankLedger(5000)] }),
                {
                    id: 'ret',
                    name: 'Torch Bearer (Acandor)',
                    type: 'character',
                    flags: { ose: { party: true } },
                    system: {
                        hp: { value: 1, max: 6 },
                        details: { class: 'Fighter' },
                        retainer: { enabled: true }
                    },
                    items: []
                }
            ]);

            eval(macroScript);

            const names = Array.from(lastDialog.element.querySelectorAll('.actor-name')).map(n => n.textContent);
            expect(names).toEqual(['Acandor (Magic User)']);
        });
    });

    test("should report no characters when the party is empty", async () => {
        game.actors.set([]);

        eval(macroScript);
        await lastDialog.processUpkeep();

        expect(ChatMessage.getCreated()[0].content).toBe('No characters in party');
    });
});
