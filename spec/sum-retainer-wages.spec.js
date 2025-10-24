const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/sum-retainer-wages.js'), 'utf8');

describe('SumRetainerWages', () => {
    let game;
    let ChatMessage;

    beforeEach(() => {
        const playerActor = {
            name: 'Player Character',
            type: 'character',
            flags: { ose: { party: true } },
            system: { details: { class: 'Fighter' }, retainer: { enabled: false } }
        };

        const retainerActor1 = {
            name: 'Retainer 1 (Player Character)',
            type: 'character',
            flags: { ose: {} },
            system: {
                details: { class: 'Fighter' },
                retainer: { enabled: true, wage: '10gp' }
            }
        };
        
        const retainerActor2 = {
            name: 'Retainer 2 (Player Character)',
            type: 'character',
            flags: { ose: {} },
            system: {
                details: { class: 'Fighter' },
                retainer: { enabled: true, wage: '5gp' }
            }
        };

        game = {
            actors: {
                filter: jest.fn(callback => [playerActor, retainerActor1, retainerActor2].filter(callback))
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
    });

    test('should sum retainer wages and create a chat message', () => {
        eval(macroScript);

        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h4>Retainer Wage Report</h4>');
        expect(messageContent).toContain('<p><strong>Retainer 1 (Player Character)</strong> (Master: Player Character): 10gp</p>');
        expect(messageContent).toContain('<p><strong>Retainer 2 (Player Character)</strong> (Master: Player Character): 5gp</p>');
        expect(messageContent).toContain('<hr><p><strong>Total Retainer Wages: 15gp</strong></p>');
    });
});
