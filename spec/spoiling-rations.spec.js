const fs = require('fs');
const path = require('path');

const macroScript = fs.readFileSync(path.resolve(__dirname, '../scripts/spoiling-rations.js'), 'utf8');

describe('SpoilingRations', () => {
    let game;
    let ChatMessage;
    let SimpleCalendar;

    beforeEach(() => {
        const actorWithSpoiledRations = {
            name: 'Actor 1',
            flags: { ose: { party: true } },
            items: [
                { name: 'Rations, Standard (1/2/2025)', flags: {}, update: jest.fn() },
                { name: 'Rations, Iron (1/15/2025)', flags: {}, update: jest.fn() }
            ]
        };
        const actorWithGoodRations = {
            name: 'Actor 2',
            flags: { ose: { party: true } },
            items: [
                { name: 'Rations, Standard (1/1/2025)', flags: {}, update: jest.fn() }
            ]
        };

        game = {
            actors: {
                filter: jest.fn().mockReturnValue([actorWithSpoiledRations, actorWithGoodRations])
            }
        };

        ChatMessage = {
            create: jest.fn()
        };

        SimpleCalendar = {
            api: {
                timestamp: jest.fn().mockReturnValue(new Date('1/10/2025').getTime()),
                formatTimestamp: jest.fn((ts) => new Date(ts).toLocaleDateString('en-US')),
                timestampPlusInterval: jest.fn((ts, interval) => ts + (interval.day * 86400000))
            }
        };

        global.game = game;
        global.ChatMessage = ChatMessage;
        global.SimpleCalendar = SimpleCalendar;
    });

    test('should spoil rations with a date older than the current date', async () => {
        const actorWithSpoiledRations = {
            name: 'Actor 1',
            flags: { ose: { party: true } },
            items: [
                { name: 'Rations, Standard (1/12/2025)', flags: {}, update: jest.fn() },
                { name: 'Rations, Iron (1/5/2025)', flags: {}, update: jest.fn() }
            ]
        };
        game.actors.filter.mockReturnValue([actorWithSpoiledRations]);

        await eval(`(async () => { ${macroScript} })()`);

        const spoiledRation = actorWithSpoiledRations.items[0];
        const goodRation = actorWithSpoiledRations.items[1];

        expect(spoiledRation.update).toHaveBeenCalledWith({ name: 'Rations, Standard (1/10/2025)', flags: { core: { spoiled: true } } });
        expect(goodRation.update).not.toHaveBeenCalled();
        
        expect(ChatMessage.create).toHaveBeenCalled();
        const messageContent = ChatMessage.create.mock.calls[0][0].content;
        expect(messageContent).toContain('<h2>Rations Spoiling Report</h2>');
        expect(messageContent).toContain('<b>Actor 1:</b>  Rations, Standard (1/10/2025)');
    });
});
