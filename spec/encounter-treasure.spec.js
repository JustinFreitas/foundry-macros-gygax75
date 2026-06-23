const {
    CONFIG,
    randInt,
    roll2d6,
    rollBudget,
    pickGem,
    splitCoins,
    composeHaul
} = require("../scripts/encounter-treasure.js");

// A small seedable PRNG (mulberry32) so "random" runs are reproducible.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const gemValues = CONFIG.GEM_LADDER.map((g) => g.value);

describe("encounter-treasure pure logic", () => {
    describe("randInt / roll2d6", () => {
        test("randInt stays within inclusive bounds", () => {
            const rng = mulberry32(1);
            for (let i = 0; i < 500; i++) {
                const n = randInt(2, 8, rng);
                expect(n).toBeGreaterThanOrEqual(2);
                expect(n).toBeLessThanOrEqual(8);
                expect(Number.isInteger(n)).toBe(true);
            }
        });

        test("2d6 is in [2,12]", () => {
            const rng = mulberry32(7);
            for (let i = 0; i < 500; i++) {
                const n = roll2d6(rng);
                expect(n).toBeGreaterThanOrEqual(2);
                expect(n).toBeLessThanOrEqual(12);
            }
        });
    });

    describe("rollBudget", () => {
        test("floors level at 1 and never produces a non-positive budget", () => {
            const rng = mulberry32(3);
            for (const lvl of [0, -5, 1, 2, 3, 6]) {
                const { level, budget } = rollBudget(lvl, CONFIG, rng);
                expect(level).toBeGreaterThanOrEqual(1);
                expect(budget).toBeGreaterThanOrEqual(1);
            }
        });

        test("average budget tracks level * BASE within the 2d6/7 spread", () => {
            for (const lvl of [1, 2, 3, 5]) {
                const rng = mulberry32(100 + lvl);
                let sum = 0;
                const N = 4000;
                for (let i = 0; i < N; i++) sum += rollBudget(lvl, CONFIG, rng).budget;
                const avg = sum / N;
                const target = lvl * CONFIG.BASE_GP_PER_LEVEL;
                // 2d6/7 has mean 1.0, so the average should sit within ~8% of target.
                expect(avg).toBeGreaterThan(target * 0.9);
                expect(avg).toBeLessThan(target * 1.1);
            }
        });
    });

    describe("pickGem", () => {
        test("returns null when even the smallest gem is unaffordable", () => {
            const rng = mulberry32(5);
            expect(pickGem(9, CONFIG, rng)).toBeNull();
        });

        test("only ever returns gems from the denominated ladder", () => {
            const rng = mulberry32(11);
            for (let i = 0; i < 1000; i++) {
                const remaining = randInt(10, 2000, rng);
                const gem = pickGem(remaining, CONFIG, rng);
                if (gem) expect(gemValues).toContain(gem.value);
            }
        });

        test("never bumps past the top of the ladder", () => {
            const rng = mulberry32(13);
            for (let i = 0; i < 500; i++) {
                const gem = pickGem(100000, CONFIG, rng);
                expect(gem.value).toBeLessThanOrEqual(Math.max(...gemValues));
            }
        });
    });

    describe("splitCoins", () => {
        test("small hauls are all GP (no platinum spam)", () => {
            const out = splitCoins(120, CONFIG);
            expect(out.every((c) => c.kind === "GP")).toBe(true);
            expect(out.reduce((s, c) => s + c.quantity * c.value, 0)).toBe(120);
        });

        test("large hauls use platinum but conserve total value exactly", () => {
            const out = splitCoins(1000, CONFIG);
            expect(out.some((c) => c.kind === "PP")).toBe(true);
            const total = out.reduce((s, c) => s + c.quantity * c.value, 0);
            expect(total).toBe(1000);
        });

        test("coin quantities are whole numbers", () => {
            for (const gp of [37, 200, 533, 1234]) {
                for (const c of splitCoins(gp, CONFIG)) {
                    expect(Number.isInteger(c.quantity)).toBe(true);
                    expect(c.quantity).toBeGreaterThan(0);
                }
            }
        });
    });

    describe("composeHaul", () => {
        test("totalGp equals the rolled budget (value is conserved)", () => {
            const rng = mulberry32(42);
            for (let i = 0; i < 2000; i++) {
                const lvl = randInt(1, 4, rng);
                const haul = composeHaul(lvl, CONFIG, rng);
                expect(haul.totalGp).toBe(haul.budget);
            }
        });

        test("haul is coin-heavy: coin value >= the configured floor of the budget", () => {
            const rng = mulberry32(2024);
            for (let i = 0; i < 2000; i++) {
                const haul = composeHaul(randInt(1, 4, rng), CONFIG, rng);
                const coinGp = haul.coins.reduce((s, c) => s + c.quantity * c.value, 0);
                const nonCoin = haul.totalGp - coinGp;
                // Non-coin (gem + jewelry) never exceeds the (1 - floor) reserve, so coin
                // value always stays at or above the floor fraction of the budget.
                expect(nonCoin).toBeLessThanOrEqual(
                    Math.floor(haul.budget * (1 - CONFIG.COIN_FLOOR_FRACTION))
                );
                expect(coinGp).toBeGreaterThanOrEqual(
                    haul.budget - Math.floor(haul.budget * (1 - CONFIG.COIN_FLOOR_FRACTION))
                );
            }
        });

        test("gems always come from the denominated ladder; jewelry sets a positive value", () => {
            const rng = mulberry32(777);
            for (let i = 0; i < 2000; i++) {
                const haul = composeHaul(randInt(1, 4, rng), CONFIG, rng);
                if (haul.gem) expect(gemValues).toContain(haul.gem.value);
                if (haul.jewelry) expect(haul.jewelry.value).toBeGreaterThanOrEqual(25);
            }
        });

        test("no magic items are ever produced", () => {
            const rng = mulberry32(99);
            for (let i = 0; i < 1000; i++) {
                const haul = composeHaul(randInt(1, 6, rng), CONFIG, rng);
                const blob = JSON.stringify(haul).toLowerCase();
                expect(blob).not.toContain("magic");
                // shape sanity: only coins/gem/jewelry carry value
                expect(haul).toHaveProperty("coins");
                expect(haul).not.toHaveProperty("magic");
            }
        });

        test("average total tracks level * BASE across many runs", () => {
            for (const lvl of [1, 2, 3]) {
                const rng = mulberry32(500 + lvl);
                let sum = 0;
                const N = 5000;
                for (let i = 0; i < N; i++) sum += composeHaul(lvl, CONFIG, rng).totalGp;
                const avg = sum / N;
                const target = lvl * CONFIG.BASE_GP_PER_LEVEL;
                expect(avg).toBeGreaterThan(target * 0.9);
                expect(avg).toBeLessThan(target * 1.1);
            }
        });
    });
});
