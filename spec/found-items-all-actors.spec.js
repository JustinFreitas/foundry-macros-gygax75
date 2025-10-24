
describe('found-items-all-actors.js', () => {
    let mockGame;
    let mockChatMessage;

    // Helper to create a mock item
    const createMockItem = (name, quantity, type = 'item') => ({
        name: name,
        type: type,
        system: { quantity: { value: quantity } },
    });

    // Helper to create a mock actor
    const createMockActor = (name, isItemPile, items = []) => ({
        name: name,
        flags: { "item-piles": { data: { enabled: isItemPile } } },
        items: items,
    });

    // Function to encapsulate the script's logic for testing
    const runScript = async () => {
        const nameToItemsMap = new Map();
        const nonItemPilesActors = mockGame.actors.filter(
            (actor) => !actor.flags["item-piles"]?.data?.enabled
        );
        for (const actor of nonItemPilesActors) {
            const foundItems = actor.items.filter(
                (item) => item.type === "item" && item.name?.includes("(Found)")
            );
            for (const item of foundItems) {
                const found = `${item.system.quantity.value || 0} ${item.name}`;
                nameToItemsMap.set(actor.name, [
                    ...(nameToItemsMap.get(actor.name) ?? []),
                    found,
                ]);
            }
        }

        if (nameToItemsMap.keys().toArray().length > 0) {
            const collatedItems = [];
            for (const actorName of nameToItemsMap.keys()) {
                collatedItems.push(
                    `<b>${actorName}:</b>  ${nameToItemsMap.get(actorName).sort().join(", ")}<br/>`
                );
            }

            mockChatMessage.create({
                content: "<h4>Found Treasure Report</h4>" + collatedItems.join("<br/>"),
            });
        } else {
            mockChatMessage.create({
                content:
                    "<h4>Found Treasure Report</h4>No (Found) items in any actor.",
            });
        }
    };

    beforeEach(() => {
        mockGame = {
            actors: [],
        };
        mockChatMessage = {
            create: jest.fn(),
        };
        // Make mocks available globally for the script to access
        global.game = mockGame;
        global.ChatMessage = mockChatMessage;
    });

    it('should report no found items if no actors are present', async () => {
        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: "<h4>Found Treasure Report</h4>No (Found) items in any actor.",
        });
    });

    it('should report no found items if only item-pile actors are present', async () => {
        const itemPileActor = createMockActor('Pile Actor', true, [createMockItem('Gold (Found)', 10)]);
        mockGame.actors = [itemPileActor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: "<h4>Found Treasure Report</h4>No (Found) items in any actor.",
        });
    });

    it('should report no found items if non-item-pile actors have no found items', async () => {
        const actor = createMockActor('Hero', false, [createMockItem('Sword', 1)]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: "<h4>Found Treasure Report</h4>No (Found) items in any actor.",
        });
    });

    it('should report found items for non-item-pile actors', async () => {
        const foundItem1 = createMockItem('Gold (Found)', 10);
        const foundItem2 = createMockItem('Silver (Found)', 20);
        const normalItem = createMockItem('Potion', 1);
        const actor = createMockActor('Hero', false, [foundItem1, foundItem2, normalItem]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Hero:</b>  10 Gold (Found), 20 Silver (Found)<br/>',
        });
    });

    it('should handle multiple non-item-pile actors with found items', async () => {
        const foundItem1 = createMockItem('Gem (Found)', 1);
        const actor1 = createMockActor('Hero 1', false, [foundItem1]);

        const foundItem2 = createMockItem('Jewelry (Found)', 1);
        const actor2 = createMockActor('Hero 2', false, [foundItem2]);

        mockGame.actors = [actor1, actor2];

        await runScript();
        const expectedContent = [
            '<h4>Found Treasure Report</h4>',
            '<b>Hero 1:</b>  1 Gem (Found)<br/>',
            '<br/>', // This is the missing <br/> from the join
            '<b>Hero 2:</b>  1 Jewelry (Found)<br/>',
        ].join('');
        expect(mockChatMessage.create).toHaveBeenCalledWith({ content: expectedContent });
    });

    it('should correctly sort found items for an actor', async () => {
        const foundItem1 = createMockItem('Zircon (Found)', 1);
        const foundItem2 = createMockItem('Amethyst (Found)', 2);
        const actor = createMockActor('Hero', false, [foundItem1, foundItem2]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Hero:</b>  1 Zircon (Found), 2 Amethyst (Found)<br/>',
        });
    });

    it('should handle items with quantity 0', async () => {
        const foundItem = createMockItem('Empty Pouch (Found)', 0);
        const actor = createMockActor('Hero', false, [foundItem]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Hero:</b>  0 Empty Pouch (Found)<br/>',
        });
    });
});
