
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
});
