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
            flags: { ose: { party: true } },
            system: { details: { class: 'Thief' } },
            items: {
                getName: jest.fn().mockReturnValue(bankItem2)
            }
        };

        game = {
            actors: {
                filter: jest.fn().mockReturnValue([actor1, actor2]),
                get: jest.fn().mockImplementation((id) => {
                    if (id === 'actor1') return actor1;
                    if (id === 'actor2') return actor2;
                    return undefined;
                })
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
        global.ui = { notifications: { info: jest.fn() } };

        global.Dialog = jest.fn().mockImplementation((dialogData) => {
            // Capture the callback to run it manually in tests
            if (dialogData.buttons && dialogData.buttons.calculate) {
                capturedCallback = dialogData.buttons.calculate.callback;
            }
            return {
                render: jest.fn()
            };
        });
    });

    test('should correctly calculate and update bank totals for multiple actors', async () => {
        // 1. Run the macro script to register the Dialog
        eval(macroScript);

        // 2. Prepare the mock HTML input
        const mockHtml = {
            find: jest.fn().mockReturnValue([
                { value: '50', name: 'actor1' },
                { value: '25', name: 'actor2' }
            ])
        };

        // 3. Execute the callback
        await capturedCallback(mockHtml);

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
            find: jest.fn().mockReturnValue([
                { value: '50', name: 'actor1' },
                { value: '25', name: 'actor2' }
            ])
        };

        await capturedCallback(mockHtml);

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
            find: jest.fn().mockReturnValue([
                { value: '0', name: 'actor1' },
                { value: '-10', name: 'actor2' }
            ])
        };

        await capturedCallback(mockHtml);

        // Verify: No updates called
        expect(bankItem1.update).not.toHaveBeenCalled();
        expect(bankItem2.update).not.toHaveBeenCalled();

        // Verify: Notification shown instead of ChatMessage
        expect(ui.notifications.info).toHaveBeenCalledWith("No deposits passed.");
        expect(ChatMessage.create).not.toHaveBeenCalled();
    });

    test('should report when no eligible characters are in the party', async () => {
        game.actors.filter.mockReturnValue([]);

        eval(macroScript);

        const mockHtml = {
            find: jest.fn().mockReturnValue([])
        };

        // The callback might not even run if the script logic prevents it, 
        // but the script creates the Dialog even if list is empty?
        // Script: `partyActors.forEach...` -> empty form.
        // Dialog created. User clicks Process.
        // inputs is empty.

        await capturedCallback(mockHtml);

        // inputs loop doesn't run.
        // updates is empty.
        // logs has header.
        // updates.length is 0.
        // ui.notifications.info is called.

        expect(ui.notifications.info).toHaveBeenCalledWith("No deposits passed.");
    });
});
