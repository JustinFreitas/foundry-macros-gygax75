describe('exhaustion-party-remove.js', () => {
    let mockGame;
    let mockCONFIG;
    let mockChatMessage;
    let consoleLogSpy;

    // Function to encapsulate the script's logic for testing
    const runScript = async () => {
        // This is the content of exhaustion-party-remove.js, adapted to use passed-in mocks
        const exhaustedEffectId = mockCONFIG.statusEffects.find((el)=>el.name?.includes('Exhausted'))?.id || 'downgrade';
        const nameToBonusAndWeaponsTupleMap = new Map();
        const bonus = 1;
        const partySheetActors = mockGame.actors.filter(actor => actor.flags.ose?.party === true);

        for (const actor of partySheetActors) {
            if (!actor.flags.ose?.exhausted) {
                console.log(`Skipping ${actor.name} as not exhausted.`);
                continue;
            }

            console.log(`Removing exhaustion for ${actor.name}`);
            const weapons = [];
            const actorWeapons = actor.items.filter(i => i.type === 'weapon');
            for (const item of actorWeapons) {
                await item.update({system: {bonus: item.system.bonus + bonus}});
                weapons.push(`${item.name} (${item.system.bonus})`);
            }

            nameToBonusAndWeaponsTupleMap.set(actor.name, { bonus: bonus, weapons: weapons });
            await actor.toggleStatusEffect(exhaustedEffectId, {active: false});
            await actor.update({flags: {ose: {exhausted: false}}});
        }

        if (nameToBonusAndWeaponsTupleMap.keys().toArray().length > 0) {
            const collatedItems = [];
            const actorNames = Array.from(nameToBonusAndWeaponsTupleMap.keys()).sort();
            for (const actorName of actorNames) {
                const bonusAndWeaponsTuple = nameToBonusAndWeaponsTupleMap.get(actorName);
                const weaponsOutput = bonusAndWeaponsTuple.weapons.length > 0 ? bonusAndWeaponsTuple.weapons.sort().join(", ") : 'No weapons modified';
                collatedItems.push(`<b>${actorName}:</b>  Removing exhaustion.  ${weaponsOutput}.<br/>`);    
            }

            mockChatMessage.create({content: '<h4>Remove Exhaustion Report</h4>' + collatedItems.join('<br/>')});
        } else {
            mockChatMessage.create({content: '<h4>Remove Exhaustion Report</h4>No exhaustion was removed.  Either no party actors or none were exhausted.'});
        }
    };

    // Helper to create a mock weapon that updates its system.bonus on update call
    const createMockWeapon = (name, bonus) => {
        const weapon = {
            name: name,
            type: 'weapon',
            system: { bonus: bonus },
            update: jest.fn(async (data) => {
                if (data.system && typeof data.system.bonus !== 'undefined') {
                    weapon.system.bonus = data.system.bonus; // Update the mock object's state
                }
            }),
        };
        return weapon;
    };

    beforeEach(() => {
        // Reset mocks before each test
        mockGame = {
            actors: [],
        };
        mockCONFIG = {
            statusEffects: [{ id: 'exhausted', name: 'Exhausted' }],
        };
        mockChatMessage = {
            create: jest.fn(),
        };
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Make mocks available globally for the script to access
        global.game = mockGame;
        global.CONFIG = mockCONFIG;
        global.ChatMessage = mockChatMessage;
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('should not remove exhaustion if no party actors are found', async () => {
        await runScript();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Remove Exhaustion Report</h4>No exhaustion was removed.  Either no party actors or none were exhausted.'
        });
    });

    it('should not remove exhaustion if all party actors are not exhausted', async () => {
        const mockActor1 = {
            name: 'Actor1',
            flags: { ose: { party: true, exhausted: false } },
            items: [],
            toggleStatusEffect: jest.fn(),
            update: jest.fn(),
        };
        mockGame.actors = [mockActor1];

        await runScript();

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping Actor1 as not exhausted.');
        expect(mockActor1.toggleStatusEffect).not.toHaveBeenCalled();
        expect(mockActor1.update).not.toHaveBeenCalled();
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Remove Exhaustion Report</h4>No exhaustion was removed.  Either no party actors or none were exhausted.'
        });
    });

    it('should remove exhaustion from exhausted party actors with weapons', async () => {
        const mockWeapon1 = createMockWeapon('Sword', -1);
        const mockWeapon2 = createMockWeapon('Bow', 0);

        const mockActor1 = {
            name: 'Actor1',
            flags: { ose: { party: true, exhausted: true } },
            items: [mockWeapon1, mockWeapon2],
            toggleStatusEffect: jest.fn(),
            update: jest.fn(),
        };
        mockGame.actors = [mockActor1];

        await runScript();

        expect(consoleLogSpy).toHaveBeenCalledWith('Removing exhaustion for Actor1');
        expect(mockWeapon1.update).toHaveBeenCalledWith({ system: { bonus: 0 } });
        expect(mockWeapon2.update).toHaveBeenCalledWith({ system: { bonus: 1 } });
        expect(mockActor1.toggleStatusEffect).toHaveBeenCalledWith('exhausted', { active: false });
        expect(mockActor1.update).toHaveBeenCalledWith({ flags: { ose: { exhausted: false } } });
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Remove Exhaustion Report</h4><b>Actor1:</b>  Removing exhaustion.  Bow (1), Sword (0).<br/>'
        });
    });

    it('should remove exhaustion from exhausted party actors without weapons', async () => {
        const mockActor1 = {
            name: 'Actor1',
            flags: { ose: { party: true, exhausted: true } },
            items: [{ name: 'Potion', type: 'consumable' }], // No weapons
            toggleStatusEffect: jest.fn(),
            update: jest.fn(),
        };
        mockGame.actors = [mockActor1];

        await runScript();

        expect(consoleLogSpy).toHaveBeenCalledWith('Removing exhaustion for Actor1');
        expect(mockActor1.toggleStatusEffect).toHaveBeenCalledWith('exhausted', { active: false });
        expect(mockActor1.update).toHaveBeenCalledWith({ flags: { ose: { exhausted: false } } });
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Remove Exhaustion Report</h4><b>Actor1:</b>  Removing exhaustion.  No weapons modified.<br/>'
        });
    });

    it('should handle multiple party actors, some exhausted, some not', async () => {
        const mockWeapon1 = createMockWeapon('Axe', -1);

        const mockActor1 = {
            name: 'Actor1',
            flags: { ose: { party: true, exhausted: false } },
            items: [],
            toggleStatusEffect: jest.fn(),
            update: jest.fn(),
        };
        const mockActor2 = {
            name: 'Actor2',
            flags: { ose: { party: true, exhausted: true } },
            items: [mockWeapon1],
            toggleStatusEffect: jest.fn(),
            update: jest.fn(),
        };
        mockGame.actors = [mockActor1, mockActor2];

        await runScript();

        expect(consoleLogSpy).toHaveBeenCalledWith('Skipping Actor1 as not exhausted.');
        expect(consoleLogSpy).toHaveBeenCalledWith('Removing exhaustion for Actor2');
        expect(mockActor1.toggleStatusEffect).not.toHaveBeenCalled();
        expect(mockActor1.update).not.toHaveBeenCalled();
        expect(mockWeapon1.update).toHaveBeenCalledWith({ system: { bonus: 0 } });
        expect(mockActor2.toggleStatusEffect).toHaveBeenCalledWith('exhausted', { active: false });
        expect(mockActor2.update).toHaveBeenCalledWith({ flags: { ose: { exhausted: false } } });
        expect(mockChatMessage.create).toHaveBeenCalledWith({
            content: '<h4>Remove Exhaustion Report</h4><b>Actor2:</b>  Removing exhaustion.  Axe (0).<br/>'
        });
    });
});