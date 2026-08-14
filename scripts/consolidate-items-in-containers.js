/*
 * This script goes through the containers of the selected tokens' actors and consolidates items of the same name
 * into a single item with the sum of their quantities.
 *
 * It will process each selected actor's containers one by one.
 *
 * The consolidateContainer helper below is shared with actor-treasure-stow.js
 * (see scripts/lib/treasure-stow-helpers.js). Do not edit the SHARED region by
 * hand — edit the source and run scripts/lib/sync-shared.js.
 */

// <<< BEGIN SHARED: treasure-stow-helpers >>>
/**
 * Canonical gp value of a single coin, by currency (BECMI / D&D Rules
 * Cyclopedia values, with OSRIC as the fallback ruleset — they agree on these).
 *   PP = 5gp, GP = 1gp, EP = 0.5gp, SP = 0.1gp, CP = 0.01gp.
 * In the cns ("coins") encumbrance system every coin weighs 1 cn, so a coin's
 * value density (gp per cn) equals its gp value below.
 */
const COIN_GP_VALUE = { PP: 5, GP: 1, EP: 0.5, SP: 0.1, CP: 0.01 };

/**
 * Fallback gp value / encumbrance for unpriced treasure, from the D&D Rules
 * Cyclopedia treasure tables (used only when an item has no system.cost):
 *   - Gem Value Table: gem values run 10/50/100/500/1k/5k/10k gp; the median
 *     band (and stated average) is ~100 gp, and every gem is exactly 1 cn.
 *   - Jewelry Value Table: values 100gp..50,000gp with Enc 10-50 cn; a typical
 *     mid-table piece is ~2,500 gp at ~25 cn.
 * Coins (all 1 cn) use COIN_GP_VALUE above, which matches the RC exchange rate
 * (100cp = 10sp = 2ep = 1gp = 1/5 pp). OSRIC agrees on all of these.
 */
const TREASURE_NAME_GP_VALUE = { Jewelry: 2500, Gem: 100 };
const TREASURE_NAME_ENC = { Jewelry: 25, Gem: 1 };

/**
 * Pull an explicit gp value out of a name like "Gem 1000gp", "Jewelry (500 gp)",
 * or "Ruby 5,000 GP". Returns the number, or null if the name states no value.
 * This is preferred over the generic gem/jewelry averages because the world's
 * treasure items encode their real value directly in the name.
 */
function parseGpFromName(itemName) {
    if (!itemName) return null;
    const m = String(itemName).match(/([\d,]+(?:\.\d+)?)\s*gp\b/i);
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Estimate a single unit's gp value from its name. Returns null when the name
 * carries no recognizable value signal (caller should fall back to name rank).
 * Priority: an explicit "NNN gp" in the name, then gem/jewelry averages, then
 * coin codes. Matching is case-insensitive; coin codes are word-bounded and the
 * longer/rarer keys are checked first to avoid "GP" matching inside "PP".
 */
function estimateUnitGpValue(itemName) {
    if (!itemName) return null;
    const name = String(itemName);
    const explicit = parseGpFromName(name);
    if (explicit != null) return explicit;
    for (const key of ["Jewelry", "Gem"]) {
        if (new RegExp(`\\b${key}`, "i").test(name)) return TREASURE_NAME_GP_VALUE[key];
    }
    for (const key of ["PP", "GP", "EP", "SP", "CP"]) {
        if (new RegExp(`\\b${key}\\b`, "i").test(name)) return COIN_GP_VALUE[key];
    }
    return null;
}

/**
 * Estimate a single unit's encumbrance (cn) from its name, used only as a
 * fallback when the item has no system.weight. Coins and gems are 1 cn; jewelry
 * averages ~25 cn (Rules Cyclopedia). Returns null when nothing is recognized.
 */
function estimateUnitEnc(itemName) {
    if (!itemName) return null;
    const name = String(itemName);
    if (/\bJewelry/i.test(name)) return TREASURE_NAME_ENC.Jewelry;
    if (/\bGem/i.test(name)) return TREASURE_NAME_ENC.Gem;
    if (/\b(PP|GP|EP|SP|CP)\b/i.test(name)) return 1;
    return null;
}

/**
 * Per-unit gp value of an item. Prefers the OSE `system.cost` price recorded on
 * the item (also what Item Piles uses as ITEM_PRICE_ATTRIBUTE); falls back to a
 * name-based estimate (gems/jewelry/coins) when cost is missing or zero.
 * `unitCost` is item.system.cost (gp each). Returns null when nothing is known.
 */
function unitGpValue(itemName, unitCost) {
    const cost = Number(unitCost);
    if (Number.isFinite(cost) && cost > 0) return cost;
    return estimateUnitGpValue(itemName);
}

/**
 * Value density (gp per cns) of one unit of an item. Higher = stow first.
 * Uses real weight when provided, else a name-based encumbrance estimate
 * (gems/coins 1 cn, jewelry ~25 cn). A truly weightless valued item uses its
 * raw gp value (effectively infinite density). Unknown value returns 0 so such
 * items sort after anything we can value.
 */
function unitValueDensity(itemName, unitWeight, unitCost) {
    const gp = unitGpValue(itemName, unitCost);
    if (gp == null) return 0;
    let w = Number(unitWeight);
    if (!Number.isFinite(w) || w <= 0) w = estimateUnitEnc(itemName) ?? 0;
    return w > 0 ? gp / w : Infinity;
}

/**
 * Ordering comparator for treasure items: highest value density first, ties
 * broken by name for stable, predictable output. Mundane (non-treasure)
 * equipment is forced to the end via `isTreasure` so treasure always stows
 * before equipment regardless of density. Items may carry `cost` (gp each); when
 * absent the density falls back to the name-based estimate.
 */
function compareTreasurePriority(a, b) {
    if (a.isTreasure !== b.isTreasure) return a.isTreasure ? -1 : 1;
    const da = unitValueDensity(a.name, a.weight, a.cost);
    const db = unitValueDensity(b.name, b.weight, b.cost);
    if (db !== da) return db - da;
    return String(a.name).localeCompare(String(b.name));
}

/**
 * Ordering comparator for a character's fillable containers (stow targets).
 * Containers already holding normal (non-treasure) items are a last resort:
 * they sort after all other free-space containers, so they're only filled once
 * everything else is exhausted. Within each group, partially-filled containers
 * come first (top off existing stacks), then the tightest remaining capacity
 * first to pack efficiently.
 * Each entry: { capacity, remaining, partiallyFilled, hasNormalItems }.
 */
function compareFillableContainers(a, b) {
    if (a.hasNormalItems !== b.hasNormalItems) return a.hasNormalItems ? 1 : -1;
    if (a.partiallyFilled !== b.partiallyFilled) return a.partiallyFilled ? -1 : 1;
    if (a.partiallyFilled && b.partiallyFilled) return a.remaining - b.remaining;
    return a.capacity - b.capacity;
}

/**
 * Consolidate same-name items within a single container into one stack.
 * Returns true if any consolidation happened (so callers can report it).
 * Only merges items sharing name AND unit weight, so distinct-weight items of
 * the same name are never silently collapsed (and value is not lost).
 */
async function consolidateContainer(actor, container) {
    console.log(`Consolidating items in container '${container.name}' for actor '${actor.name}'.`);
    const itemsInContainer = actor.items.filter(item => item.system.containerId === container.id);
    if (itemsInContainer.length === 0) return false;

    const groups = itemsInContainer.reduce((acc, item) => {
        const key = `${item.name}|${item.system.weight ?? 0}|${item.system.cost ?? 0}`;
        (acc[key] ||= []).push(item);
        return acc;
    }, {});

    let consolidated = false;
    for (const key in groups) {
        const items = groups[key];
        if (items.length > 1) {
            consolidated = true;
            const firstItem = items[0];
            const totalQuantity = items.reduce((sum, item) => sum + (item.system?.quantity?.value ?? 1), 0);
            await actor.updateEmbeddedDocuments("Item", [{ _id: firstItem.id, "system.quantity.value": totalQuantity }]);
            const idsToDelete = items.slice(1).map(item => item.id);
            await actor.deleteEmbeddedDocuments("Item", idsToDelete);
        }
    }
    return consolidated;
}

/**
 * Test whether an item on an Item Pile is a lootable physical item.
 * Excludes non-physical Foundry documents like spells and abilities,
 * and requires a quantity greater than zero.
 */
function isLootableItem(item) {
    if (!item) return false;
    if (item.type === "spell" || item.type === "ability") return false;
    const qty = item.system?.quantity?.value ?? 1;
    return qty > 0;
}
// <<< END SHARED: treasure-stow-helpers >>>

(async () => {
  const selectedTokens = canvas.tokens.controlled;
  if (selectedTokens.length === 0) {
    ui.notifications.warn("Please select at least one token.");
    return;
  }

  for (const token of selectedTokens) {
    const actor = token.actor;
    if (!actor) continue;

    const containers = actor.items.filter(item => item.type === 'container');
    if (containers.length === 0) {
      ui.notifications.info(`No containers found for ${actor.name}.`);
      continue;
    }

    let itemsUpdated = false;
    for (const container of containers) {
      if (await consolidateContainer(actor, container)) {
        itemsUpdated = true;
      }
    }

    if (itemsUpdated) {
      ui.notifications.info(`Consolidated items for ${actor.name}.`);
    } else {
      ui.notifications.info(`No items to consolidate for ${actor.name}.`);
    }
  }
})();
