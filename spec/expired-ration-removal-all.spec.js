
describe('expired-ration-removal-all.js', () => {
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
    const createMockActor = (id, name, items = [], inExpedition = false) => ({
        id: id,
        name: name,
        items: items,
        flags: { ose: { party: true } }, // Assuming all eligible actors are party members for this script
        // Mocking the filter method for items to simulate actor.items.filter
        filter: jest.fn(callback => items.filter(callback)),
    });

    // Helper to create a mock scene
    const createMockScene = (name, tokens = []) => ({
        name: name,
        tokens: tokens,
    });

    // Helper to create a mock token
    const createMockToken = (actorId) => ({
        actorId: actorId,
    });

    // Function to encapsulate the script's logic for testing
    const runScript = async () => {
        // This is the content of expired-ration-removal-all.js, adapted to use passed-in mocks

        // Get all scenes that include "expedition" in their name (case-insensitive)
        const expeditionScenes = mockGame.scenes.filter(scene => scene.name.toLowerCase().includes("expedition"));

        // Create a Set of actor IDs that have tokens in those scenes
        const actorsInExpedition = new Set();

        for (const scene of expeditionScenes) {
            for (const token of scene.tokens) {
                if (token.actorId) actorsInExpedition.add(token.actorId);
            }
        }

        // Example: Filter a list of actors to exclude those already in expedition scenes
        const eligibleActors = mockGame.actors.filter(actor => !actorsInExpedition.has(actor.id));

        // Do something with eligibleActors
        console.log("Actors not in expedition scenes:", eligibleActors.map(a => a.name));

        const violations = [];
        for (const actor of eligibleActors) {
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
            };
        }

        if (violations.length > 0) {
            mockChatMessage.create({content: '<h4>Expired Rations Report - All</h4>' + violations.join('<br/><br/>')});
        } else {
            mockChatMessage.create({content: '<h4>Expired Rations Report - All</h4>No rations were deleted.'});
        }
    };

    beforeEach(() => {
        // Reset mocks before each test
        mockGame = {
            scenes: [],
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

    it('should report no rations deleted if no eligible actors have rations', async () => {
        const actor1 = createMockActor('actor1', 'Actor One', [createMockItem('Sword', 1)]);
        mockGame.actors = [actor1];

        await runScript();

        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - All</h4>No rations were deleted.'
        });
        expect(actor1.items[0].delete).not.toHaveBeenCalled();
    });

    it('should delete expired rations from eligible actors (without SimpleCalendar)', async () => {
        const expiredRation = createMockItem('Rations, standard (1/1/2020)', 5);
        const nonExpiredRation = createMockItem('Rations, standard (1/1/2030)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation, nonExpiredRation]);
        mockGame.actors = [actor1];

        await runScript();

        expect(expiredRation.delete).toHaveBeenCalledTimes(1);
        expect(nonExpiredRation.delete).not.toHaveBeenCalled();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - All</h4><b>Actor One:</b> Rations, standard (1/1/2020) with quantity 5 was removed.'
        });
    });

    it('should delete expired rations from eligible actors (with SimpleCalendar)', async () => {
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
            content: '<h4>Expired Rations Report - All</h4><b>Actor One:</b> Rations, standard (1/1/2020) with quantity 5 was removed.'
        });
    });

    it('should not process actors in expedition scenes', async () => {
        const expiredRation = createMockItem('Rations, standard (1/1/2020)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation]);
        const token1 = createMockToken('actor1');
        const expeditionScene = createMockScene('My Expedition', [token1]);

        mockGame.actors = [actor1];
        mockGame.scenes = [expeditionScene];

        await runScript();

        expect(expiredRation.delete).not.toHaveBeenCalled();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - All</h4>No rations were deleted.'
        });
    });

    it('should process eligible actors and skip actors in expedition scenes', async () => {
        const expiredRation1 = createMockItem('Rations, standard (1/1/2020)', 5);
        const nonExpiredRation1 = createMockItem('Rations, standard (1/1/2030)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation1, nonExpiredRation1]); // Eligible

        const expiredRation2 = createMockItem('Rations, standard (1/1/2020)', 3);
        const actor2 = createMockActor('actor2', 'Actor Two', [expiredRation2]); // In expedition
        const token2 = createMockToken('actor2');
        const expeditionScene = createMockScene('My Expedition', [token2]);

        mockGame.actors = [actor1, actor2];
        mockGame.scenes = [expeditionScene];

        await runScript();

        expect(expiredRation1.delete).toHaveBeenCalledTimes(1);
        expect(nonExpiredRation1.delete).not.toHaveBeenCalled();
        expect(expiredRation2.delete).not.toHaveBeenCalled(); // Should not be processed

        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Expired Rations Report - All</h4><b>Actor One:</b> Rations, standard (1/1/2020) with quantity 5 was removed.'
        });
    });

    it('should handle multiple eligible actors with expired rations', async () => {
        const expiredRation1 = createMockItem('Rations, standard (1/1/2020)', 5);
        const actor1 = createMockActor('actor1', 'Actor One', [expiredRation1]);

        const expiredRation2 = createMockItem('Rations, iron (2/1/2021)', 2);
        const actor2 = createMockActor('actor2', 'Actor Two', [expiredRation2]);

        mockGame.actors = [actor1, actor2];

        await runScript();

        expect(expiredRation1.delete).toHaveBeenCalledTimes(1);
        expect(expiredRation2.delete).toHaveBeenCalledTimes(1);

        const expectedContent = [
            '<h4>Expired Rations Report - All</h4>',
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
            content: '<h4>Expired Rations Report - All</h4>No rations were deleted.'
        });
    });
});
