// Encounter Treasure — supplemental loot for a wandering monster's carried/worn wealth.
//
// Purpose: published modules are often under-stocked for ~1 level / 3-4 sessions of
// advancement. This macro lets the DM TOP UP via a PUBLIC roll (the dice decide, not
// the DM), framed as coins/gems a monster was carrying, and drops the result straight
// into the Item Pile on the active scene so the loot physically appears for the party.
//
// Design (all dials are the CONFIG constants below):
//   - Budget per drop ~= level * BASE_GP_PER_LEVEL, with a 2d6/7 spread (~30%-170% of
//     target) so it never looks like a flat handout.
//   - Mostly COIN (GP, plus PP once the haul is large enough to avoid coin spam), an
//     occasional GEM (drawn from the world's denominated Gem items by their set cost,
//     NOT a fabricated value), and a rare JEWELRY piece (the only fabricated value,
//     since the world has no denominated jewelry item).
//   - No magic items: magic stays a deliberate, hand-placed DM choice.
//
// Pure helpers (composeHaul + friends) are unit-tested via spec/encounter-treasure.spec.js;
// the Foundry-only part runs only inside Foundry (guarded at the bottom).

const CONFIG = {
    BASE_GP_PER_LEVEL: 120,   // generosity dial: average gp of a level-1 drop
    GEM_CHANCE: 0.55,         // chance the haul includes a gem
    JEWELRY_CHANCE: 0.12,     // chance the haul includes a jewelry piece (rare)
    COIN_FLOOR_FRACTION: 0.5, // never let coin drop below this fraction of the budget
    PP_THRESHOLD_GP: 200,     // convert part of the coin to platinum above this haul size
    // World source items (verified ids in the old-school-essentials world).
    GEM_LADDER: [
        { name: "Gem 10gp", value: 10, id: "M30AYsYWvuPK4Tse" },
        { name: "Gem 50gp", value: 50, id: "e08C7kQQ47xffBHV" },
        { name: "Gem 100gp", value: 100, id: "WvJcisR3jOH2vLg9" },
        { name: "Gem 500gp", value: 500, id: "cOs5Zzay2dV4OoTX" },
        { name: "Gem 1000gp", value: 1000, id: "gLUQIDEk5F0hE4Q4" }
    ],
    COIN: {
        GP: { name: "GP", value: 1, id: "xYjJVzdv26B6y492" },
        PP: { name: "PP", value: 5, id: "Hh1DIjjSYsdf5o4i" }
    },
    JEWELRY_SOURCE: { name: "Jewelry (Found)", id: "4kYiEmhNnvNiH9z3" }
};

// ---------------------------------------------------------------------------
// Pure logic (no Foundry globals) — unit tested.
// ---------------------------------------------------------------------------

// Inclusive integer in [min, max] using the injected rng (defaults to Math.random).
function randInt(min, max, rng = Math.random) {
    return min + Math.floor(rng() * (max - min + 1));
}

// 2d6 with the injected rng.
function roll2d6(rng = Math.random) {
    return randInt(1, 6, rng) + randInt(1, 6, rng);
}

// Target budget for a drop: level * BASE scaled by a 2d6/7 spread (avg 1.0, ~0.29-1.71).
// Returns { level, spreadRoll, budget }.
function rollBudget(level, cfg = CONFIG, rng = Math.random) {
    const lvl = Math.max(1, Math.floor(level) || 1);
    const spreadRoll = roll2d6(rng);
    const budget = Math.max(1, Math.round(lvl * cfg.BASE_GP_PER_LEVEL * (spreadRoll / 7)));
    return { level: lvl, spreadRoll, budget };
}

// Pick the largest gem whose value is <= remaining, occasionally (1-in-3) bumping one
// rung up to justify a slightly richer piece "it was wearing" -- but only when the
// bumped rung still fits within `remaining`, so the gem never breaks the coin floor.
// Returns a GEM_LADDER entry, or null if even the smallest gem exceeds remaining.
function pickGem(remaining, cfg = CONFIG, rng = Math.random) {
    const affordableIdx = cfg.GEM_LADDER
        .map((g, i) => ({ g, i }))
        .filter(({ g }) => g.value <= remaining)
        .map(({ i }) => i);
    if (affordableIdx.length === 0) return null;
    let idx = affordableIdx[affordableIdx.length - 1]; // largest affordable rung
    const next = idx + 1;
    if (next < cfg.GEM_LADDER.length && cfg.GEM_LADDER[next].value <= remaining && rng() < 1 / 3) {
        idx = next; // occasional bump, still within budget
    }
    return cfg.GEM_LADDER[idx];
}

// Split a coin gp amount into GP and (above threshold) PP stacks. PP soaks up most of
// the value in big hauls so the pile isn't thousands of GP tokens; the remainder is GP.
// Returns an array of { kind: 'PP'|'GP', quantity, value }.
function splitCoins(coinGp, cfg = CONFIG) {
    const out = [];
    let remaining = Math.max(0, Math.round(coinGp));
    if (remaining >= cfg.PP_THRESHOLD_GP) {
        // Put ~70% of the value into platinum, rounded down to whole PP.
        const ppCount = Math.floor((remaining * 0.7) / cfg.COIN.PP.value);
        if (ppCount > 0) {
            out.push({ kind: "PP", quantity: ppCount, value: cfg.COIN.PP.value });
            remaining -= ppCount * cfg.COIN.PP.value;
        }
    }
    if (remaining > 0) out.push({ kind: "GP", quantity: remaining, value: cfg.COIN.GP.value });
    return out;
}

// Compose a full haul for a dungeon level. Returns:
//   { level, spreadRoll, budget, coins:[{kind,quantity,value}], gem|null, jewelry|null, totalGp }
// gem = a GEM_LADDER entry; jewelry = { value } (fabricated). Coin always >= COIN_FLOOR.
function composeHaul(level, cfg = CONFIG, rng = Math.random) {
    const { level: lvl, spreadRoll, budget } = rollBudget(level, cfg, rng);

    let gem = null;
    let jewelry = null;
    let nonCoin = 0;

    // Reserve room for coin so the haul stays coin-heavy.
    const maxNonCoin = Math.floor(budget * (1 - cfg.COIN_FLOOR_FRACTION));

    if (rng() < cfg.GEM_CHANCE) {
        gem = pickGem(maxNonCoin, cfg, rng);
        if (gem) nonCoin += gem.value;
    }

    if (rng() < cfg.JEWELRY_CHANCE && nonCoin < maxNonCoin) {
        // Jewelry value: whatever non-coin budget is left, rounded to a tidy 10 gp,
        // floored at 25 gp so a piece is always worth naming.
        const room = maxNonCoin - nonCoin;
        const value = Math.max(25, Math.round(room / 10) * 10);
        if (value <= room) {
            jewelry = { value };
            nonCoin += value;
        }
    }

    const coinGp = Math.max(0, budget - nonCoin);
    const coins = splitCoins(coinGp, cfg);

    const totalGp =
        coins.reduce((s, c) => s + c.quantity * c.value, 0) +
        (gem ? gem.value : 0) +
        (jewelry ? jewelry.value : 0);

    return { level: lvl, spreadRoll, budget, coins, gem, jewelry, totalGp };
}

// ---------------------------------------------------------------------------
// Foundry execution (runs only inside Foundry).
// ---------------------------------------------------------------------------

// Build the item objects to hand to Item Piles, cloning the world's source items so
// cost/weight/treasure/img come for free. Returns [{ item, quantity }].
function buildItemPayloads(haul, cfg = CONFIG) {
    const payloads = [];

    const clone = (sourceId, overrides = {}) => {
        const src = game.items.get(sourceId);
        if (!src) throw new Error(`Encounter Treasure: world item ${sourceId} not found`);
        const data = src.toObject();
        delete data._id;            // let Item Piles mint/merge
        foundry.utils.mergeObject(data, overrides);
        return data;
    };

    for (const coin of haul.coins) {
        const src = cfg.COIN[coin.kind];
        payloads.push({ item: clone(src.id), quantity: coin.quantity });
    }
    if (haul.gem) {
        payloads.push({ item: clone(haul.gem.id), quantity: 1 });
    }
    if (haul.jewelry) {
        payloads.push({
            item: clone(cfg.JEWELRY_SOURCE.id, {
                name: `Jewelry (${haul.jewelry.value} gp)`,
                "system.cost": haul.jewelry.value
            }),
            quantity: 1
        });
    }
    return payloads;
}

function haulToHtml(haul) {
    const rows = [];
    for (const c of haul.coins) rows.push(`<li>${c.quantity} &times; ${c.kind}</li>`);
    if (haul.gem) rows.push(`<li>1 &times; ${haul.gem.name}</li>`);
    if (haul.jewelry) rows.push(`<li>1 &times; Jewelry (${haul.jewelry.value} gp)</li>`);
    return (
        `<h2>Encounter Treasure</h2>` +
        `<p><em>Loot the creature was carrying.</em></p>` +
        `<p>Dungeon level <b>${haul.level}</b> &mdash; spread roll ${haul.spreadRoll}/7 ` +
        `&rarr; budget <b>${haul.budget} gp</b>.</p>` +
        `<ul>${rows.join("")}</ul>` +
        `<p>Total value: <b>${haul.totalGp} gp</b>.</p>`
    );
}

// Prompt for the dungeon level (default 1), returning an integer or null if cancelled.
async function promptLevel() {
    return await new Promise((resolve) => {
        const { DialogV2 } = foundry.applications.api;
        const dialog = new DialogV2({
            classes: ["ose", "dialog"],
        position: { width: 400, height: "auto" },
        window: { title: "Encounter Treasure" },
            content: `<p>Dungeon level for this drop:</p>
                <input type="number" min="1" step="1" value="1" style="width:100%"
                       id="enc-treasure-level" autofocus/>`,
            buttons: [
                {
                    action: "roll",
                    label: "Roll Loot",
                    default: true,
                    callback: (event, button, dialog) => {
                        const el = dialog.element.querySelector("#enc-treasure-level");
                        const n = Math.max(1, Math.floor(Number(el?.value)) || 1);
                        resolve(n);
                    }
                },
                { action: "cancel", label: "Cancel", callback: () => resolve(null) }
            ]
        });
    dialog.render(true);
    });
}

async function runEncounterTreasure() {
    // 1. Find the single enabled Item Pile on the active scene.
    const pileTokens = canvas.scene.tokens.filter(
        (t) => t.actor && t.actor.flags["item-piles"]?.data?.enabled
    );
    if (pileTokens.length !== 1) {
        ui.notifications.warn(
            `Encounter Treasure: expected 1 item pile on the scene, found ${pileTokens.length}.`
        );
        return;
    }
    const pileActor = pileTokens[0].actor;

    // 2. Prompt for level and compose the haul.
    const level = await promptLevel();
    if (level === null) return; // cancelled
    const haul = composeHaul(level, CONFIG);

    // 3. Drop the loot into the pile.
    const payloads = buildItemPayloads(haul, CONFIG);
    await game.itempiles.API.addItems(pileActor, payloads);

    // 4. Public reveal (no whisper) so the table sees the roll.
    await ChatMessage.create({ content: haulToHtml(haul) });
    ui.notifications.info(`Encounter Treasure: ${haul.totalGp} gp added to ${pileActor.name}.`);
}

// Run only inside Foundry; stay inert when required by jest. Not awaited at top level
// so the file parses cleanly under jest's CommonJS transform (no top-level await).
if (typeof canvas !== "undefined" && typeof game !== "undefined") {
    runEncounterTreasure();
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        CONFIG,
        randInt,
        roll2d6,
        rollBudget,
        pickGem,
        splitCoins,
        composeHaul
    };
}
