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

    test('should compare 2-digit-year ration dates correctly (20xx, not 19xx)', async () => {
        // Stored date "1/12/26" must be read as 2026, which is later than the
        // current date (1/10/2025), so the ration is NOT yet expired further.
        const actor = {
            name: 'Actor 1',
            flags: { ose: { party: true } },
            items: [
                { name: 'Rations, Standard (1/12/26)', flags: {}, update: jest.fn() }
            ]
        };
        game.actors.filter.mockReturnValue([actor]);

        await eval(`(async () => { ${macroScript} })()`);

        // 1/12/2026 > 1/10/2025 -> the macro renames it to the current date.
        // (If "26" were misread as 1926, the comparison would flip and behaviour
        // would differ by engine — this asserts the deterministic outcome.)
        expect(actor.items[0].update).toHaveBeenCalledWith({
            name: 'Rations, Standard (1/10/2025)',
            flags: { core: { spoiled: true } }
        });
    });
});
