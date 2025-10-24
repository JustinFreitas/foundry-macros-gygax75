const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/toggle-bless-selected-tokens.js'), 'utf8');

describe('ToggleBlessSelectedTokens', () => {
    let canvas, CONFIG, ChatMessage;

    beforeEach(() => {
        const weapon = {
            type: 'weapon',
            name: 'Sword',
            system: { bonus: 0 },
            update: jest.fn()
        };

        const actor = {
            name: 'Test Actor',
            statuses: new Set(),
            items: [weapon],
            toggleStatusEffect: jest.fn()
        };

        const token = {
            actor: actor
        };

        canvas = {
            tokens: {
                controlled: [token]
            }
        };

        CONFIG = {
            statusEffects: [{ id: 'bless', name: 'Bless' }]
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.canvas = canvas;
        global.CONFIG = CONFIG;
        global.ChatMessage = ChatMessage;
    });

    test('should add bless effect and update weapon bonus', async () => {
        await eval(`(async () => { ${macroScript} })()`);

        const token = canvas.tokens.controlled[0];
        const actor = token.actor;
        const weapon = actor.items[0];

        expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bless');
        expect(weapon.update).toHaveBeenCalledWith({ system: { bonus: 1 } });

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h2>Toggle Bless Report</h2>');
        expect(messageContent).toContain('<b>Test Actor:</b>  Adding Bless.  Sword (0).<br/>');
    });

    test('should remove bless effect and update weapon bonus', async () => {
        const actor = canvas.tokens.controlled[0].actor;
        actor.statuses.add('bless');
        actor.items[0].system.bonus = 1;

        await eval(`(async () => { ${macroScript} })()`);

        const weapon = actor.items[0];

        expect(actor.toggleStatusEffect).toHaveBeenCalledWith('bless');
        expect(weapon.update).toHaveBeenCalledWith({ system: { bonus: 0 } });

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h2>Toggle Bless Report</h2>');
        expect(messageContent).toContain('<b>Test Actor:</b>  Removing Bless.  Sword (1).<br/>');
    });
});
