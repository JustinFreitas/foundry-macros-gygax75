const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/treasure-split-with-banking.js'), 'utf8');

describe('TreasureSplitWithBanking', () => {
    let game;
    let ChatMessage;
    let actor1, actor2, bankItem1, bankItem2;
    let capturedCallback;

    beforeEach(() => {
        bankItem1 = {
            name: 'GP (Bank)',
            system: { quantity: { value: 100 } },
            update: jest.fn()
        };
        actor1 = {
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
            update: jest.fn()
        };
        actor2 = {
            name: 'Actor 2',
            flags: { ose: { party: true } },
            system: { details: { class: 'Thief' } },
            items: {
                getName: jest.fn().mockReturnValue(bankItem2)
            }
        };

        game = {
            actors: {
                filter: jest.fn().mockReturnValue([actor1, actor2])
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
        global.Dialog = jest.fn().mockImplementation((dialogData) => {
            capturedCallback = dialogData.buttons.calculate.callback;
            return {
                render: jest.fn()
            };
        });
    });

    test('should correctly calculate and update bank totals for multiple actors', async () => {
        eval(macroScript);

        const mockHtml = {
            find: jest.fn().mockReturnValue([
                { value: '50' },
                { value: '25' }
            ])
        };

        await capturedCallback(mockHtml);

        expect(bankItem1.update).toHaveBeenCalledWith({ system: { quantity: { value: 150 } } });
        expect(bankItem2.update).toHaveBeenCalledWith({ system: { quantity: { value: 75 } } });

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h2>Character Treasure Split</h2>');
        expect(messageContent).toContain('<b>Actor 1:</b> Bank deposit from 100gp to 150gp.');
        expect(messageContent).toContain('<b>Actor 2:</b> Bank deposit from 50gp to 75gp.');
    });

    test('should handle actors with no bank item gracefully', async () => {
        actor2.items.getName.mockReturnValue(undefined);
        
        eval(macroScript);

        const mockHtml = {
            find: jest.fn().mockReturnValue([
                { value: '50' },
                { value: '25' }
            ])
        };

        await capturedCallback(mockHtml);

        expect(bankItem1.update).toHaveBeenCalledWith({ system: { quantity: { value: 150 } } });
        expect(bankItem2.update).not.toHaveBeenCalled();

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<b>Actor 2:</b> No bank named GP (Bank).');
    });

    test('should handle zero and negative input values correctly', async () => {
        eval(macroScript);

        const mockHtml = {
            find: jest.fn().mockReturnValue([
                { value: '0' },
                { value: '-10' }
            ])
        };

        await capturedCallback(mockHtml);

        expect(bankItem1.update).not.toHaveBeenCalled();
        expect(bankItem2.update).not.toHaveBeenCalled();
        
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<b>Actor 1:</b> No change.');
        expect(messageContent).toContain('<b>Actor 2:</b> No change.');
    });

    test('should report when no eligible characters are in the party', async () => {
        game.actors.filter.mockReturnValue([]);
        
        eval(macroScript);
        
        const mockHtml = {
            find: jest.fn().mockReturnValue([])
        };

        await capturedCallback(mockHtml);

        expect(ChatMessage.create).toHaveBeenCalledWith({ content: 'No eligible characters in party.' });
    });
});
