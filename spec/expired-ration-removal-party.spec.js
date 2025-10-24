
describe('expired-ration-removal-party.js', () => {
    let mockGame;
    let mockSimpleCalendar;
    let mockChatMessage;
    let consoleLogSpy;

    // Helper to create a mock item
    const createMockItem = (name, quantity, type = 'item') => ({
        name: name,
        type: type,
        system: { quantity: { value: quantity } },
        delete: jest.fn(),
    });

    // Helper to create a mock actor
    const createMockActor = (id, name, items = []) => ({
        id: id,
        name: name,
        items: items,
        flags: { ose: { party: true } }, // All actors are assumed to be party members for this script
        // Mocking the filter method for items to simulate actor.items.filter
        filter: jest.fn(callback => items.filter(callback)),
    });

    // Function to encapsulate the script's logic for testing
    const runScript = async () => {
        // This is the content of expired-ration-removal-party.js, adapted to use passed-in mocks
        const violations = [];
        const partySheetActors = mockGame.actors.filter(actor => actor.flags.ose?.party === true);
        for (const actor of partySheetActors) {
            for (const item of actor.items) {
                const found = item.name.match(/rations, (iron|standard|fresh food|preserved meat) \((?<date>[^)]+)\)/i);
                if (found?.groups?.date) {
                    const rationDate = new Date(found.groups.date);
                    let todayDate = new Date(new Date().toDateString());
                    if (typeof mockSimpleCalendar !== 'undefined') {
                        const currentTimestamp = mockSimpleCalendar.api.timestamp();
                        todayDate = new Date(mockSimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY'));
                    }

                    if (rationDate < todayDate) {
                        const violation = `<b>${actor.name}:</b> ${item.name} with quantity ${item.system.quantity.value} was removed.`;
                        console.log(violation);
                        violations.push(violation);
                        item.delete();
                    }
                }
            }
        }

        if (violations.length > 0) {
            mockChatMessage.create({content: '<h4>Expired Rations Report - Party</h4>' + violations.join('<br/><br/>')});
        } else {
            mockChatMessage.create({content: '<h4>Expired Rations Report - Party</h4>No rations were deleted.'});
        }
    };

    beforeEach(() => {
        // Reset mocks before each test
        mockGame = {
            actors: [],
        };
        mockSimpleCalendar = undefined; // Default to undefined
        mockChatMessage = {
            create: jest.fn(),
        };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Make mocks available globally for the script to access (though runScript uses passed-in mocks)
        global.game = mockGame;
        global.SimpleCalendar = mockSimpleCalendar;
        global.ChatMessage = mockChatMessage;
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('should report no rations deleted if no party actors are found', async () => {
        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - Party</h4>No rations were deleted.'
        });
    });

    it('should report no rations deleted if no eligible actors have rations', async () => {
        const actor1 = createMockActor('actor1', 'Actor One', [createMockItem('Sword', 1)]);
        mockGame.actors = [actor1];

        await runScript();

        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - Party</h4>No rations were deleted.'
        });
        expect(actor1.items[0].delete).not.toHaveBeenCalled();
    });

    it('should delete expired rations from party actors (without SimpleCalendar)', async () => {
        const expiredRation = createMockItem('Rations, standard (1/1/2020)', 5);
        const nonExpiredRation = createMockItem('Rations, standard (1/1/2030)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation, nonExpiredRation]);
        mockGame.actors = [actor1];

        await runScript();

        expect(expiredRation.delete).toHaveBeenCalledTimes(1);
        expect(nonExpiredRation.delete).not.toHaveBeenCalled();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - Party</h4><b>Actor One:</b> Rations, standard (1/1/2020) with quantity 5 was removed.'
        });
    });

    it('should delete expired rations from party actors (with SimpleCalendar)', async () => {
        mockSimpleCalendar = {
            api: {
                timestamp: jest.fn(() => 1672531200), // Jan 1, 2023
                formatTimestamp: jest.fn((ts, format) => '1/1/2023'),
            },
        };
        global.SimpleCalendar = mockSimpleCalendar; // Update global mock

        const expiredRation = createMockItem('Rations, standard (1/1/2020)', 5);
        const nonExpiredRation = createMockItem('Rations, standard (1/1/2030)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation, nonExpiredRation]);
        mockGame.actors = [actor1];

        await runScript();

        expect(expiredRation.delete).toHaveBeenCalledTimes(1);
        expect(nonExpiredRation.delete).not.toHaveBeenCalled();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - Party</h4><b>Actor One:</b> Rations, standard (1/1/2020) with quantity 5 was removed.'
        });
    });

    it('should handle multiple party actors with expired rations', async () => {
        const expiredRation1 = createMockItem('Rations, standard (1/1/2020)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation1]);

        const expiredRation2 = createMockItem('Rations, iron (2/1/2021)', 2);
        const actor2 = createMockActor('actor2', 'Actor Two', [expiredRation2]);

        mockGame.actors = [actor1, actor2];

        await runScript();

        expect(expiredRation1.delete).toHaveBeenCalledTimes(1);
        expect(expiredRation2.delete).toHaveBeenCalledTimes(1);

        const expectedContent = [
            '<h4>Expired Rations Report - Party</h4>',
            '<b>Actor One:</b> Rations, standard (1/1/2020) with quantity 5 was removed.<br/><br/>',
            '<b>Actor Two:</b> Rations, iron (2/1/2021) with quantity 2 was removed.',
        ].join('');

        expect(mockChatMessage.create).toHaveBeenCalledWith({ content: expectedContent });
    });

    it('should not delete non-ration items', async () => {
        const nonRationItem = createMockItem('Sword', 1);
        const actor1 = createMockActor('actor1', 'Actor One', [nonRationItem]);
        mockGame.actors = [actor1];

        await runScript();

        expect(nonRationItem.delete).not.toHaveBeenCalled();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - Party</h4>No rations were deleted.'
        });
    });
});
