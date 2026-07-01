global.$ = (x) => x;
const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/treasure-split-with-banking.js'), 'utf8');

describe('TreasureSplitWithBanking', () => {
    let game;
    let ChatMessage;
    // We update global.ui in beforeEach
    let actor1, actor2, bankItem1, bankItem2;
    let capturedCallback;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        bankItem1 = {
            name: 'GP (Bank)',
            system: { quantity: { value: 100 } },
            update: jest.fn().mockResolvedValue({}) // Promise-based update
        };

        actor1 = {
            id: 'actor1',
            name: 'Actor 1',
            type: 'character',
            flags: { ose: { party: true } },
            system: { details: { class: 'Fighter' } },
            items: {
                getName: jest.fn().mockReturnValue(bankItem1)
            }
        };

        bankItem2 = {
            name: 'GP (Bank)',
            system: { quantity: { value: 50 } },
            update: jest.fn().mockResolvedValue({})
        };

        actor2 = {
            id: 'actor2',
            name: 'Actor 2',
            type: 'character',
            flags: { ose: { party: true } },
            system: { details: { class: 'Thief' } },
            items: {
                getName: jest.fn().mockReturnValue(bankItem2)
            }
        };

        game = {
            actors: {
                _data: [actor1, actor2],
                filter: jest.fn(function(fn) { return this._data.filter(fn); }),
                forEach: jest.fn(function(fn) { return this._data.forEach(fn); }),
                get: jest.fn().mockImplementation((id) => {
                    if (id === 'actor1') return actor1;
                    if (id === 'actor2') return actor2;
                    return undefined;
                })
            }
        };
        global.game = game;

        ChatMessage = {
            create: jest.fn()
        };

        global.ChatMessage = ChatMessage;
        global.ui = { notifications: { info: jest.fn() } };

        global.foundry = {
            applications: {
                api: {
                    DialogV2: {
                        wait: jest.fn().mockImplementation((dialogData) => {
                            if (dialogData.buttons) {
                                // V2 buttons are an array
                                const calcBtn = dialogData.buttons.find(b => b.action === 'calculate');
                                if (calcBtn) capturedCallback = calcBtn.callback;
                            }
                            return Promise.resolve(null);
                        })
                    }
                }
            }
        };

        global.Dialog = {
            wait: jest.fn().mockImplementation((dialogData) => {
                if (dialogData.buttons && dialogData.buttons.calculate) {
                    capturedCallback = dialogData.buttons.calculate.callback;
                }
                return Promise.resolve(null);
            })
        };

        global.jQuery = jest.fn();
    });

    test('should correctly calculate and update bank totals for multiple actors', async () => {
        // 1. Run the macro script to register the Dialog
        eval(macroScript);

        // 2. Prepare the mock HTML input
        const mockHtml = {
            querySelectorAll: jest.fn().mockReturnValue([
                { value: '50', name: 'actor1' },
                { value: '25', name: 'actor2' }
            ]),
            find: jest.fn().mockReturnValue([ // Fallback for any remaining .find calls
                { value: '50', name: 'actor1' },
                { value: '25', name: 'actor2' }
            ])
        };

        // 3. Execute the callback
        // The script handles both jQuery (V1) and raw DOM (V2).
        // Since we are mocking DialogV2, we must pass the dialog object as the third argument.
        await capturedCallback({}, {}, { element: mockHtml });

        // 4. Verify updates
        expect(bankItem1.update).toHaveBeenCalledWith({ system: { quantity: { value: 150 } } });
        expect(bankItem2.update).toHaveBeenCalledWith({ system: { quantity: { value: 75 } } });

        // 5. Verify Chat Message
        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h2>Character Treasure Split</h2>');
        expect(messageContent).toContain('<b>Actor 1:</b> Bank deposit 50gp (100 ➔ 150).');
        expect(messageContent).toContain('<b>Actor 2:</b> Bank deposit 25gp (50 ➔ 75).');
    });

    test('should handle actors with no bank item gracefully', async () => {
        // Setup: actor2 has no bank item
        actor2.items.getName.mockReturnValue(undefined);

        eval(macroScript);

        const mockHtml = {
            querySelectorAll: jest.fn().mockReturnValue([
                { value: '50', name: 'actor1' },
                { value: '25', name: 'actor2' }
            ])
        };

        await capturedCallback({}, {}, { element: mockHtml });

        // Verify: actor1 updated, actor2 skipped
        expect(bankItem1.update).toHaveBeenCalledWith({ system: { quantity: { value: 150 } } });
        expect(bankItem2.update).not.toHaveBeenCalled();

        // Verify logs
        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<b>Actor 2:</b> <span style="color:red">Missing bank item \'GP (Bank)\'.</span>');
    });

    test('should handle zero and negative input values correctly by ignoring them', async () => {
        eval(macroScript);

        const mockHtml = {
            querySelectorAll: jest.fn((selector) => {
                if (selector === 'input') {
                    return [
                        { value: '0', name: 'actor1' },
                        { value: '-10', name: 'actor2' }
                    ];
                }
                return [];
            })
        };

        await capturedCallback({}, {}, { element: mockHtml });

        // Verify: No updates called
        expect(bankItem1.update).not.toHaveBeenCalled();
        expect(bankItem2.update).not.toHaveBeenCalled();

        // Verify: Notification shown instead of ChatMessage
        expect(ui.notifications.info).toHaveBeenCalledWith("No deposits passed.");
        expect(ChatMessage.create).not.toHaveBeenCalled();
    });

    test('should exclude non-character actors (no system.details.class) without throwing', () => {
        // A vehicle/item-pile that happens to carry the ose.party flag but has no
        // details.class. Before the type guard, `.class.toLowerCase()` threw here.
        const vehicle = {
            id: 'vehicle1',
            name: 'Wagon',
            type: 'vehicle',
            flags: { ose: { party: true } },
            system: {},
            items: { getName: jest.fn() }
        };
        game.actors._data = [actor1, vehicle];

        let capturedActors;
        global.game.actors.filter = jest.fn(function (fn) {
            capturedActors = this._data.filter(fn);
            return capturedActors;
        });

        expect(() => eval(macroScript)).not.toThrow();
        // Only the real character survives the filter.
        expect(capturedActors).toEqual([actor1]);
    });

    test('should report when no eligible characters are in the party', async () => {
        global.game.actors.filter.mockReturnValue([]);

        eval(macroScript);

        const mockHtml = {
            querySelectorAll: jest.fn().mockReturnValue([])
        };

        await capturedCallback({}, {}, { element: mockHtml });

        // inputs loop doesn't run.
        // updates is empty.
        // logs has header.
        // updates.length is 0.
        // ui.notifications.info is called.

        expect(ui.notifications.info).toHaveBeenCalledWith("No deposits passed.");
    });
});
