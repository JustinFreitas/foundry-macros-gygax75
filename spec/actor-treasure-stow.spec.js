
const {
    parseGpFromName,
    estimateUnitGpValue,
    estimateUnitEnc,
    unitValueDensity,
    compareTreasurePriority,
    compareFillableContainers,
    consolidateContainer,
    COIN_GP_VALUE,
} = require('../scripts/lib/treasure-stow-helpers.js');

describe('actor-treasure-stow.js', () => {

    // These helpers (getCapacityLimit, getAvailableCapacity, getClassPrecedence)
    // are closures inside stowTreasure() and can't be imported, so they are
    // mirrored here. The shared, importable helpers below are tested directly.
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

    describe('Encumbrance calculations', () => {
        const createMockActor = (className, maxEncumbrance, currentEncumbrance, encumbranceSteps) => ({
            system: {
                details: { class: className },
                encumbrance: {
                    max: maxEncumbrance,
                    value: currentEncumbrance,
                    steps: encumbranceSteps || [0, 50, 100]
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
                expect(getCapacityLimit(actor, false)).toBe(100);
            });

            it('should return calculated capacity for other classes with different steps when fillToAbsoluteMax is false', () => {
                const actor = createMockActor("Fighter", 100, 0, [0, 25, 50]);
                expect(getCapacityLimit(actor, false)).toBe(50);
            });
        });

        describe('getAvailableCapacity', () => {
            it('should return remaining capacity for a normal actor', () => {
                const actor = createMockActor("Fighter", 100, 20, [0, 50, 100]);
                expect(getAvailableCapacity(actor, false)).toBe(80);
            });

            it('should return remaining capacity for a Floating Disc', () => {
                const actor = createMockActor("Floating Disc", 100, 20);
                expect(getAvailableCapacity(actor, false)).toBe(80);
            });

            it('should return negative when current encumbrance exceeds capacity limit', () => {
                const actor = createMockActor("Fighter", 100, 120, [0, 50, 100]);
                expect(getAvailableCapacity(actor, false)).toBe(-20);
            });
        });
    });

    describe('value density', () => {
        describe('parseGpFromName', () => {
            it('reads an explicit gp value out of the name', () => {
                expect(parseGpFromName("Gem 1000gp")).toBe(1000);
                expect(parseGpFromName("Gem 100gp")).toBe(100);
                expect(parseGpFromName("Jewelry (500 gp)")).toBe(500);
                expect(parseGpFromName("Ruby 5,000 GP")).toBe(5000);
            });

            it('returns null when no value is stated', () => {
                expect(parseGpFromName("Gem")).toBeNull();
                expect(parseGpFromName("Silver Comb")).toBeNull();
                expect(parseGpFromName(undefined)).toBeNull();
            });
        });

        describe('estimateUnitEnc', () => {
            it('uses RC encumbrances: gems/coins 1 cn, jewelry ~25 cn', () => {
                expect(estimateUnitEnc("Gem 1000gp")).toBe(1);
                expect(estimateUnitEnc("GP")).toBe(1);
                expect(estimateUnitEnc("Jewelry")).toBe(25);
            });

            it('returns null for unrecognized names', () => {
                expect(estimateUnitEnc("Mysterious Idol")).toBeNull();
            });
        });

        describe('estimateUnitGpValue', () => {
            it('ranks coins by canonical gp value', () => {
                expect(estimateUnitGpValue("PP")).toBe(COIN_GP_VALUE.PP);
                expect(estimateUnitGpValue("GP")).toBe(1);
                expect(estimateUnitGpValue("EP")).toBe(0.5);
                expect(estimateUnitGpValue("SP")).toBe(0.1);
                expect(estimateUnitGpValue("CP")).toBe(0.01);
            });

            it('values gems and jewelry above coins', () => {
                expect(estimateUnitGpValue("Gem")).toBeGreaterThan(estimateUnitGpValue("PP"));
                expect(estimateUnitGpValue("Jewelry")).toBeGreaterThan(estimateUnitGpValue("Gem"));
            });

            it('matches plural and prefixed names', () => {
                expect(estimateUnitGpValue("Gems")).toBe(estimateUnitGpValue("Gem"));
            });

            it('reads an explicit "NNN gp" value out of a name ahead of coin codes', () => {
                // "Gem 1000gp" must value as 1000, not the generic gem average.
                expect(estimateUnitGpValue("Gem 1000gp")).toBe(1000);
                // A bare coin item is named just its code; value is the per-coin gp.
                expect(estimateUnitGpValue("GP")).toBe(1);
            });

            it('does not match GP inside PP and vice versa', () => {
                expect(estimateUnitGpValue("PP")).toBe(5);
            });

            it('returns null for unrecognized names', () => {
                expect(estimateUnitGpValue("Mysterious Idol")).toBeNull();
                expect(estimateUnitGpValue("")).toBeNull();
                expect(estimateUnitGpValue(undefined)).toBeNull();
            });
        });

        describe('unitValueDensity', () => {
            it('is gp per unit weight (name-based fallback)', () => {
                expect(unitValueDensity("Gem", 1)).toBe(100);
                expect(unitValueDensity("GP", 2)).toBe(0.5);
            });

            it('treats weightless valued items as their raw gp value', () => {
                expect(unitValueDensity("Gem", 0)).toBe(100);
            });

            it('returns 0 for unknown value', () => {
                expect(unitValueDensity("Mysterious Idol", 5)).toBe(0);
            });

            it('prefers the OSE system.cost price when present', () => {
                // Idol has no name signal, but a real cost of 5000gp at weight 10 = 500/cns.
                expect(unitValueDensity("Mysterious Idol", 10, 5000)).toBe(500);
            });

            it('cost overrides the name-based estimate', () => {
                // A "Gem" appraised at only 5gp should use the real cost, not 100.
                expect(unitValueDensity("Gem", 1, 5)).toBe(5);
            });

            it('falls back to name estimate when cost is zero/missing', () => {
                expect(unitValueDensity("Gem", 1, 0)).toBe(100);
                expect(unitValueDensity("Gem", 1, undefined)).toBe(100);
            });
        });

        describe('compareTreasurePriority', () => {
            const t = (name, weight) => ({ name, weight, isTreasure: true });

            it('orders by value density, highest first', () => {
                const items = [t("CP", 1), t("Gem", 1), t("GP", 1), t("PP", 1)];
                const sorted = [...items].sort(compareTreasurePriority).map(i => i.name);
                expect(sorted).toEqual(["Gem", "PP", "GP", "CP"]);
            });

            it('accounts for weight when ranking density', () => {
                // 1 PP (5gp) at weight 1 = density 5; 10 GP-each? Here a heavy gem loses to light platinum.
                const heavyGem = t("Gem", 200); // 100/200 = 0.5
                const platinum = t("PP", 1);     // 5/1 = 5
                const sorted = [heavyGem, platinum].sort(compareTreasurePriority).map(i => i.name);
                expect(sorted).toEqual(["PP", "Gem"]);
            });

            it('always places mundane equipment after treasure', () => {
                const equipment = { name: "Rope", weight: 1, isTreasure: false };
                const cheapTreasure = t("CP", 1);
                const sorted = [equipment, cheapTreasure].sort(compareTreasurePriority).map(i => i.name);
                expect(sorted).toEqual(["CP", "Rope"]);
            });

            it('breaks ties by name', () => {
                const sorted = [t("Gem (Ruby)", 1), t("Gem (Emerald)", 1)].sort(compareTreasurePriority).map(i => i.name);
                expect(sorted).toEqual(["Gem (Emerald)", "Gem (Ruby)"]);
            });

            it('uses real cost to rank an otherwise-unnamed valuable above coins', () => {
                const idol = { name: "Idol", weight: 5, cost: 5000, isTreasure: true }; // 1000/cns
                const platinum = t("PP", 1); // 5/cns
                const sorted = [platinum, idol].sort(compareTreasurePriority).map(i => i.name);
                expect(sorted).toEqual(["Idol", "PP"]);
            });

            it('ranks named-value gems correctly even with no cost field (world data)', () => {
                // Matches the real world items: "Gem NNNNgp" at weight 1, no cost.
                const items = [
                    { name: "GP", weight: 1, isTreasure: true },
                    { name: "Gem 1000gp", weight: 1, isTreasure: true },
                    { name: "Gem 10gp", weight: 1, isTreasure: true },
                    { name: "Gem 100gp", weight: 1, isTreasure: true },
                ];
                const sorted = [...items].sort(compareTreasurePriority).map(i => i.name);
                expect(sorted).toEqual(["Gem 1000gp", "Gem 100gp", "Gem 10gp", "GP"]);
            });
        });
    });

    describe('compareFillableContainers', () => {
        // entry: { id, capacity, remaining, partiallyFilled, hasNormalItems }
        const c = (id, {capacity = 100, remaining = capacity, partiallyFilled = false, hasNormalItems = false} = {}) =>
            ({ id, capacity, remaining, partiallyFilled, hasNormalItems });

        it('puts containers holding normal items last (last resort)', () => {
            const order = [
                c("normal", {hasNormalItems: true}),
                c("treasureOnly", {hasNormalItems: false}),
            ].sort(compareFillableContainers).map(x => x.id);
            expect(order).toEqual(["treasureOnly", "normal"]);
        });

        it('a normal-item container loses even to a smaller empty treasure-only one', () => {
            const order = [
                c("normalBig", {capacity: 500, hasNormalItems: true}),
                c("emptySmall", {capacity: 50, hasNormalItems: false}),
            ].sort(compareFillableContainers).map(x => x.id);
            expect(order).toEqual(["emptySmall", "normalBig"]);
        });

        it('within the non-normal group, partially-filled come before empty', () => {
            const order = [
                c("empty", {partiallyFilled: false}),
                c("partial", {partiallyFilled: true, remaining: 40}),
            ].sort(compareFillableContainers).map(x => x.id);
            expect(order).toEqual(["partial", "empty"]);
        });

        it('partially-filled tiebreak: tightest remaining capacity first', () => {
            const order = [
                c("loose", {partiallyFilled: true, remaining: 80}),
                c("tight", {partiallyFilled: true, remaining: 20}),
            ].sort(compareFillableContainers).map(x => x.id);
            expect(order).toEqual(["tight", "loose"]);
        });

        it('empty tiebreak: smallest capacity first', () => {
            const order = [
                c("big", {capacity: 200}),
                c("small", {capacity: 60}),
            ].sort(compareFillableContainers).map(x => x.id);
            expect(order).toEqual(["small", "big"]);
        });

        it('full ordering across all groups', () => {
            const order = [
                c("normalPartial", {partiallyFilled: true, remaining: 10, hasNormalItems: true}),
                c("emptyBig", {capacity: 300}),
                c("partialTight", {partiallyFilled: true, remaining: 15}),
                c("emptySmall", {capacity: 40}),
                c("partialLoose", {partiallyFilled: true, remaining: 90}),
            ].sort(compareFillableContainers).map(x => x.id);
            // partially-filled (tightest first), then empty (smallest first), then normal-item last
            expect(order).toEqual(["partialTight", "partialLoose", "emptySmall", "emptyBig", "normalPartial"]);
        });
    });

    describe('consolidateContainer', () => {
        const makeActor = (items) => {
            const actor = {
                name: "Test Actor",
                items,
                updateEmbeddedDocuments: jest.fn(),
                deleteEmbeddedDocuments: jest.fn(),
            };
            actor.items.get = jest.fn((id) => actor.items.find(item => item.id === id));
            return actor;
        };

        const item = (id, name, qty, weight, containerId = "container1") => ({
            id, name,
            system: { quantity: { value: qty }, weight, containerId }
        });

        const container = { id: "container1", name: "Backpack (100)", system: { totalWeight: 0 } };

        it('consolidates duplicate same-name same-weight items', async () => {
            const actor = makeActor([
                container,
                item("item1", "Rope", 1, 5),
                item("item2", "Rope", 1, 5),
                item("item3", "Torch", 2, 1),
            ]);

            const result = await consolidateContainer(actor, container);

            expect(result).toBe(true);
            expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith(
                "Item",
                [{ _id: "item1", "system.quantity.value": 2 }]
            );
            expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["item2"]);
        });

        it('does NOT merge same-name items of different weight (value preserved)', async () => {
            const actor = makeActor([
                container,
                item("g1", "Gem", 1, 1),
                item("g2", "Gem", 1, 3),
            ]);

            const result = await consolidateContainer(actor, container);

            expect(result).toBe(false);
            expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
            expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
        });

        it('returns false and does nothing when there are no duplicates', async () => {
            const actor = makeActor([
                container,
                item("item1", "Rope", 1, 5),
                item("item3", "Torch", 2, 1),
            ]);

            const result = await consolidateContainer(actor, container);

            expect(result).toBe(false);
            expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
            expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
        });

        it('ignores items in other containers', async () => {
            const actor = makeActor([
                container,
                item("item1", "Rope", 1, 5, "container1"),
                item("item2", "Rope", 1, 5, "container2"),
            ]);

            const result = await consolidateContainer(actor, container);

            expect(result).toBe(false);
            expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
            expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
        });
    });
});
