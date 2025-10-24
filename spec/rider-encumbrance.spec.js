const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/rider-encumbrance.js'), 'utf8');

describe('RiderEncumbrance', () => {
    let game;
    let ChatMessage;

    beforeEach(() => {
        const ridingHorse = {
            name: 'Riding Horse (Player)',
            system: { details: { class: 'Riding Horse' } },
            items: [{
                name: 'Riders Encumbrance',
                system: { quantity: { value: 10 } },
                update: jest.fn()
            }]
        };

        const playerActor = {
            name: 'Player',
            flags: { ose: { party: true } },
            system: { encumbrance: { value: 20 } }
        };

        game = {
            actors: {
                filter: jest.fn().mockReturnValue([playerActor]),
                search: jest.fn().mockReturnValue([ridingHorse])
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
    });

    test('should update rider encumbrance item', () => {
        eval(macroScript);

        expect(game.actors.filter).toHaveBeenCalled();
        expect(game.actors.search).toHaveBeenCalledWith({ query: '(Player)' });
        
        const horse = game.actors.search()[0];
        const encumbranceItem = horse.items[0];
        expect(encumbranceItem.update).toHaveBeenCalledWith({ system: { quantity: { value: 20 } } });

        expect(ChatMessage.create).toHaveBeenCalled();
        const message = ChatMessage.create.mock.calls[0][0].content;
        expect(message).toContain('<h2>Rider Encumbrance Report</h2>');
        expect(message).toContain('<b>Riding Horse (Player):</b> had its Rider Encumbrance item set to <b>20</b> from <b>10</b>.');
    });
});
