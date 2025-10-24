describe('found-items-party-actors-and-mounts.js', () => {
    let mockGame;
    let mockChatMessage;

    // Helper to create a mock item
    const createMockItem = (name, quantity, type = 'item') => ({
        name: name,
        type: type,
        system: { quantity: { value: quantity } },
    });

    // Helper to create a mock actor
    const createMockActor = (id, name, isPartyMember, className = '', items = []) => ({
        id: id,
        name: name,
        flags: { ose: { party: isPartyMember } },
        system: { details: { class: className } },
        items: items,
    });

    // Function to encapsulate the script's logic for testing
    const runScript = async () => {
        const partySheetActors = mockGame.actors.filter(actor => actor.flags.ose?.party === true);
        // Get partysheet actor mounts also for the container check.
        const actorMounts = partySheetActors.filter(actor => actor.system.details.class !== 'Mule').flatMap(actor => {
            const baseActorName = actor.name.split('(')[0].trim();
            return mockGame.actors.filter(a => a.name.includes(`(${baseActorName})`) && ['Riding Horse', 'War Horse'].includes(a.system.details.class));
        });

        const partySheetActorsWithMounts = partySheetActors.concat(actorMounts);
        const nameToItemsMap = new Map();
        for (const actor of partySheetActorsWithMounts) {
            const foundItems = actor.items.filter(item => item.type === 'item' && item.name.includes('(Found)'));
            for (const item of foundItems) {
                const found = `${item.system.quantity.value || 0} ${item.name}`;
                nameToItemsMap.set(actor.name, [...nameToItemsMap.get(actor.name) ? nameToItemsMap.get(actor.name) : [], found]);
            }
        }


        if (nameToItemsMap.keys().toArray().length > 0) {
            const collatedItems = [];
            for (const actorName of nameToItemsMap.keys()) {
                collatedItems.push(`<b>${actorName}:</b>  ${nameToItemsMap.get(actorName).sort().join(", ")}<br/>`);
            }

            mockChatMessage.create({content: '<h4>Found Treasure Report</h4>' + collatedItems.join('<br/>')});
        } else {
            mockChatMessage.create({content: '<h4>Found Treasure Report</h4>No (Found) items in any actor.'});
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

    it('should report no found items if party actors have no found items', async () => {
        const actor = createMockActor('actor1', 'Hero', true, '', [createMockItem('Sword', 1)]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: "<h4>Found Treasure Report</h4>No (Found) items in any actor.",
        });
    });

    it('should report found items for party actors', async () => {
        const foundItem1 = createMockItem('Gold (Found)', 10);
        const foundItem2 = createMockItem('Silver (Found)', 20);
        const normalItem = createMockItem('Potion', 1);
        const actor = createMockActor('actor1', 'Hero', true, '', [foundItem1, foundItem2, normalItem]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Hero:</b>  10 Gold (Found), 20 Silver (Found)<br/>',
        });
    });

    it('should report found items for mounts of party actors', async () => {
        const partyActor = createMockActor('actor1', 'Hero (Rider)', true, 'Fighter', []);
        const mountActor = createMockActor('mount1', 'Riding Horse (Hero)', false, 'Riding Horse', [createMockItem('Saddlebag (Found)', 1)]);
        mockGame.actors = [partyActor, mountActor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Riding Horse (Hero):</b>  1 Saddlebag (Found)<br/>',
        });
    });

    it('should handle multiple party actors and their mounts with found items', async () => {
        const foundItem1 = createMockItem('Gem (Found)', 1);
        const actor1 = createMockActor('actor1', 'Hero 1', true, 'Fighter', [foundItem1]);

        const foundItem2 = createMockItem('Jewelry (Found)', 1);
        const actor2 = createMockActor('actor2', 'Hero 2 (Rider)', true, 'Fighter', []);
        const mountActor2 = createMockActor('mount2', 'War Horse (Hero 2)', false, 'War Horse', [foundItem2]);

        mockGame.actors = [actor1, actor2, mountActor2];

        await runScript();
        const expectedContent = [
            '<h4>Found Treasure Report</h4>',
            '<b>Hero 1:</b>  1 Gem (Found)<br/>',
            '<br/>', // Separator for multiple actors
            '<b>War Horse (Hero 2):</b>  1 Jewelry (Found)<br/>',
        ].join('');
        expect(mockChatMessage.create).toHaveBeenCalledWith({ content: expectedContent });
    });

    it('should correctly sort found items for an actor/mount', async () => {
        const foundItem1 = createMockItem('Zircon (Found)', 1);
        const foundItem2 = createMockItem('Amethyst (Found)', 2);
        const actor = createMockActor('actor1', 'Hero', true, '', [foundItem1, foundItem2]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Hero:</b>  1 Zircon (Found), 2 Amethyst (Found)<br/>',
        });
    });

    it('should handle items with quantity 0', async () => {
        const foundItem = createMockItem('Empty Pouch (Found)', 0);
        const actor = createMockActor('actor1', 'Hero', true, '', [foundItem]);
        mockGame.actors = [actor];

        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Found Treasure Report</h4><b>Hero:</b>  0 Empty Pouch (Found)<br/>',
        });
    });
});