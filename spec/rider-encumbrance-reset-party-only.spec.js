const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/rider-encumbrance-reset-party-only.js'), 'utf8');

describe('RiderEncumbranceResetPartyOnly', () => {
    let game;
    let ChatMessage;

    beforeEach(() => {
        const ridersEncumbranceItem = {
            name: 'Riders Encumbrance',
            system: { quantity: { value: 20 } },
            update: jest.fn()
        };

        const ridingHorse = {
            name: 'Riding Horse (Player)',
            system: { details: { class: 'Riding Horse' } },
            items: [ridersEncumbranceItem]
        };

        const playerActor = {
            name: 'Player',
            flags: { ose: { party: true } },
            system: { details: { class: 'Fighter' } }
        };

        game = {
            actors: {
                filter: jest.fn().mockImplementation(callback => {
                    if (callback.toString().includes('party === true')) {
                        return [playerActor];
                    }
                    return [playerActor].filter(callback);
                }),
                search: jest.fn().mockReturnValue([ridingHorse])
            },
            items: {
                getName: jest.fn()
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
    });

    test('should reset rider encumbrance item to 0', async () => {
        eval(macroScript);
        
        // Allow async operations to complete
        await new Promise(process.nextTick);

        const encumbranceItem = game.actors.search()[0].items[0];
        expect(encumbranceItem.update).toHaveBeenCalledWith({ system: { quantity: { value: 0 } } });

        expect(ChatMessage.create).toHaveBeenCalled();
        const message = ChatMessage.create.mock.calls[0][0].content;
        expect(message).toContain('<h2>Rider Encumbrance Reset Report</h2>');
        expect(message).toContain('<b>Riding Horse (Player):</b> had its Rider Encumbrance item reset to <b>0</b> from <b>20</b>.');
    });
});
