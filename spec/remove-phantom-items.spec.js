const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/remove-phantom-items.js'), 'utf8');

describe('RemovePhantomItems', () => {
    let game;
    let ChatMessage;

    beforeEach(() => {
        const buggedItem = {
            name: 'Bugged Item',
            type: 'item',
            system: { containerId: 'non-existent-id' },
            delete: jest.fn()
        };

        const normalItem = {
            name: 'Normal Item',
            type: 'item',
            system: { containerId: '' }
        };

        const actorWithBuggedItem = {
            name: 'Actor 1',
            items: [buggedItem, normalItem]
        };
        
        actorWithBuggedItem.items.get = jest.fn().mockReturnValue(undefined);

        game = {
            actors: [actorWithBuggedItem]
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
    });

    test('should delete phantom items and create a report', () => {
        eval(macroScript);

        const buggedItem = game.actors[0].items[0];
        expect(buggedItem.delete).toHaveBeenCalled();

        expect(ChatMessage.create).toHaveBeenCalled();
        const message = ChatMessage.create.mock.calls[0][0].content;
        expect(message).toContain('<h2>Remove Phantom Items Report</h2>');
        expect(message).toContain('<b>Actor 1:</b> Bugged Item');
    });
});
