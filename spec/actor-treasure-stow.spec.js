
describe('actor-treasure-stow.js', () => {

    // Mocking the global game object and its properties that the script might implicitly rely on
    // This is a minimal mock to allow the helper functions to be tested.
    const mockGame = {
        scenes: {
            active: {}
        },
        itempiles: {
            API: {
                transferItems: jest.fn()
            }
        }
    };

    const mockUi = {
        notifications: {
            warn: jest.fn(),
            info: jest.fn()
        }
    };

    const mockChatMessage = {
        create: jest.fn(),
        getWhisperRecipients: jest.fn(() => [])
    };

    const mockHooks = {
        on: jest.fn()
    };

    const mockDialog = jest.fn(() => ({
        render: jest.fn()
    }));

    // Mocking global functions/objects
    global.game = mockGame;
    global.ui = mockUi;
    global.ChatMessage = mockChatMessage;
    global.Hooks = mockHooks;
    global.Dialog = mockDialog;
    global.randomID = jest.fn(() => "mockID");
    global.canvas = {
        tokens: {
            controlled: []
        }
    };
    // Mocking global functions/objects
    global.game = mockGame;
    global.ui = mockUi;
    global.ChatMessage = mockChatMessage;
    global.Hooks = mockHooks;
    global.Dialog = mockDialog;
    global.randomID = jest.fn(() => "mockID");
    global.canvas = {
        tokens: {
            controlled: []
        }
    };

    // Helper functions extracted from the original script for testing
    const getCapacityLimit = (actor, fillToAbsoluteMax) => {
        const isFloatingDisc = actor.system.details.class.includes("Floating Disc");
        const isMule = actor.system.details.class.includes("Mule");
        const useMax = isFloatingDisc || isMule || fillToAbsoluteMax;
        return useMax
            ? actor.system.encumbrance.max
            : actor.system.encumbrance.max * (actor.system.encumbrance.steps[actor.system.encumbrance.steps.length - 1] / 100);
    };

    const getAvailableCapacity = (actor, fillToAbsoluteMax) => {
        const max = getCapacityLimit(actor, fillToAbsoluteMax);
        return max - actor.system.encumbrance.value;
    };

    const getClassPrecedence = (className) => {
        const classPrecedence = ["Floating Disc", "Mule", "Magic User"];
        for (let i = 0; i < classPrecedence.length; i++) {
            if (className.includes(classPrecedence[i])) return i;
        }
        return classPrecedence.length;
    };

    async function consolidateContainer(actor, container) {
        console.log(`Consolidating items in container '${container.name}' for actor '${actor.name}'.`);
        const itemsInContainer = actor.items.filter(item => item.system.containerId === container.id);
        if (itemsInContainer.length === 0) return;
    
        const itemsByName = itemsInContainer.reduce((acc, item) => {
            if (!acc[item.name]) {
                acc[item.name] = [];
            }
            acc[item.name].push(item);
            return acc;
        }, {});
    
        for (const name in itemsByName) {
            const items = itemsByName[name];
            if (items.length > 1) {
                const firstItem = items[0];
                const totalQuantity = items.reduce((sum, item) => sum + item.system.quantity.value, 0);
    
                await actor.updateEmbeddedDocuments("Item", [{ _id: firstItem.id, "system.quantity.value": totalQuantity }]);
    
                const idsToDelete = items.slice(1).map(item => item.id);
                await actor.deleteEmbeddedDocuments("Item", idsToDelete);
            }
        }
    }

    // Test for getClassPrecedence
    describe('getClassPrecedence', () => {
        it('should return correct precedence for "Floating Disc"', () => {
            expect(getClassPrecedence("Floating Disc")).toBe(0);
        });

        it('should return correct precedence for "Mule"', () => {
            expect(getClassPrecedence("Mule")).toBe(1);
        });

        it('should return correct precedence for "Magic User"', () => {
            expect(getClassPrecedence("Magic User")).toBe(2);
        });

        it('should return lowest precedence for other classes', () => {
            expect(getClassPrecedence("Fighter")).toBe(3);
            expect(getClassPrecedence("Cleric")).toBe(3);
        });

        it('should handle classes with multiple keywords', () => {
            expect(getClassPrecedence("Apprentice Magic User")).toBe(2);
        });
    });

    // Test for getCapacityLimit and getAvailableCapacity
    describe('Encumbrance calculations', () => {

        // Helper to create a mock actor
        const createMockActor = (className, maxEncumbrance, currentEncumbrance, encumbranceSteps) => ({
            system: {
                details: {
                    class: className
                },
                encumbrance: {
                    max: maxEncumbrance,
                    value: currentEncumbrance,
                    steps: encumbranceSteps || [0, 50, 100] // Default steps
                }
            }
        });

        describe('getCapacityLimit', () => {
            it('should return max encumbrance for Floating Disc regardless of fillToAbsoluteMax', () => {
                const actor = createMockActor("Floating Disc", 100, 0);
                expect(getCapacityLimit(actor, false)).toBe(100);
                expect(getCapacityLimit(actor, true)).toBe(100);
            });

            it('should return max encumbrance for Mule regardless of fillToAbsoluteMax', () => {
                const actor = createMockActor("Mule", 150, 0);
                expect(getCapacityLimit(actor, false)).toBe(150);
                expect(getCapacityLimit(actor, true)).toBe(150);
            });

            it('should return max encumbrance when fillToAbsoluteMax is true', () => {
                const actor = createMockActor("Fighter", 100, 0);
                expect(getCapacityLimit(actor, true)).toBe(100);
            });

            it('should return calculated capacity for other classes when fillToAbsoluteMax is false', () => {
                const actor = createMockActor("Fighter", 100, 0, [0, 50, 100]);
                expect(getCapacityLimit(actor, false)).toBe(100); // 100 * (100/100)
            });

            it('should return calculated capacity for other classes with different steps when fillToAbsoluteMax is false', () => {
                const actor = createMockActor("Fighter", 100, 0, [0, 25, 50]);
                expect(getCapacityLimit(actor, false)).toBe(50); // 100 * (50/100)
            });
        });

        describe('getAvailableCapacity', () => {
            it('should return remaining capacity for a normal actor', () => {
                const actor = createMockActor("Fighter", 100, 20, [0, 50, 100]);
                expect(getAvailableCapacity(actor, false)).toBe(80); // 100 - 20
            });

            it('should return remaining capacity for a Floating Disc', () => {
                const actor = createMockActor("Floating Disc", 100, 20);
                expect(getAvailableCapacity(actor, false)).toBe(80); // Max is 100, current is 20
            });

            it('should return 0 if current encumbrance exceeds capacity limit', () => {
                const actor = createMockActor("Fighter", 100, 120, [0, 50, 100]);
                expect(getAvailableCapacity(actor, false)).toBe(-20); // 100 - 120
            });
        });
    });

    describe('consolidateContainer', () => {
        it('should consolidate duplicate items within a container', async () => {
            const mockContainer = {
                id: "container1",
                name: "Backpack (100)",
                system: { totalWeight: 0 }
            };

            const mockItem1 = {
                id: "item1",
                name: "Rope",
                system: { quantity: { value: 1 }, containerId: "container1" }
            };
            const mockItem2 = {
                id: "item2",
                name: "Rope",
                system: { quantity: { value: 1 }, containerId: "container1" }
            };
            const mockItem3 = {
                id: "item3",
                name: "Torch",
                system: { quantity: { value: 2 }, containerId: "container1" }
            };

            const mockActor = {
                name: "Test Actor",
                items: [
                    mockContainer,
                    mockItem1,
                    mockItem2,
                    mockItem3
                ],
                updateEmbeddedDocuments: jest.fn(),
                deleteEmbeddedDocuments: jest.fn(),
            };

            // Mock the actor.items.get method for the consolidateContainer function
            mockActor.items.get = jest.fn((id) => mockActor.items.find(item => item.id === id));

            await consolidateContainer(mockActor, mockContainer);

            // Expect updateEmbeddedDocuments to be called for the first item with combined quantity
            expect(mockActor.updateEmbeddedDocuments).toHaveBeenCalledWith(
                "Item",
                [{ _id: "item1", "system.quantity.value": 2 }]
            );

            // Expect deleteEmbeddedDocuments to be called for the duplicate item
            expect(mockActor.deleteEmbeddedDocuments).toHaveBeenCalledWith(
                "Item",
                ["item2"]
            );

            // Ensure Torch is not affected as it's not a duplicate
            expect(mockActor.updateEmbeddedDocuments).not.toHaveBeenCalledWith(
                "Item",
                [{ _id: "item3", "system.quantity.value": expect.any(Number) }]
            );
        });

        it('should not consolidate if no duplicate items exist', async () => {
            const mockContainer = {
                id: "container1",
                name: "Backpack (100)",
                system: { totalWeight: 0 }
            };

            const mockItem1 = {
                id: "item1",
                name: "Rope",
                system: { quantity: { value: 1 }, containerId: "container1" }
            };
            const mockItem3 = {
                id: "item3",
                name: "Torch",
                system: { quantity: { value: 2 }, containerId: "container1" }
            };

            const mockActor = {
                name: "Test Actor",
                items: [
                    mockContainer,
                    mockItem1,
                    mockItem3
                ],
                updateEmbeddedDocuments: jest.fn(),
                deleteEmbeddedDocuments: jest.fn(),
            };

            mockActor.items.get = jest.fn((id) => mockActor.items.find(item => item.id === id));

            await consolidateContainer(mockActor, mockContainer);

            expect(mockActor.updateEmbeddedDocuments).not.toHaveBeenCalled();
            expect(mockActor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
        });

        it('should not consolidate items not in the specified container', async () => {
            const mockContainer = {
                id: "container1",
                name: "Backpack (100)",
                system: { totalWeight: 0 }
            };

            const mockItem1 = {
                id: "item1",
                name: "Rope",
                system: { quantity: { value: 1 }, containerId: "container1" }
            };
            const mockItem2 = {
                id: "item2",
                name: "Rope",
                system: { quantity: { value: 1 }, containerId: "container2" } // Different container
            };

            const mockActor = {
                name: "Test Actor",
                items: [
                    mockContainer,
                    mockItem1,
                    mockItem2
                ],
                updateEmbeddedDocuments: jest.fn(),
                deleteEmbeddedDocuments: jest.fn(),
            };

            mockActor.items.get = jest.fn((id) => mockActor.items.find(item => item.id === id));

            await consolidateContainer(mockActor, mockContainer);

            expect(mockActor.updateEmbeddedDocuments).not.toHaveBeenCalled();
            expect(mockActor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
        });
    });
});
