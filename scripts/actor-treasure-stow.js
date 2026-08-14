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

/**
 * Dual Version Shim: Works in V13 (Dialog) and V14 (DialogV2).
 */
async function dialogWaitShim({ title, content, buttons, defaultButton, ...options } = {}) {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (DialogV2) {
    return new Promise((resolve) => {
      const dialog = new DialogV2({
        classes: ["ose", "dialog"],
        position: { width: 400, height: "auto" },
        window: { title, ...options.window },
        content: content,
        buttons: Object.entries(buttons).map(([id, btn]) => ({
          action: id,
          label: btn.label,
          icon: btn.icon,
          default: id === defaultButton,
          callback: (event, button, dialog) => {
            const result = btn.callback ? btn.callback(dialog.element) : id;
            resolve(result);
            return result;
          }
        })),
        rejectClose: false,
        ...options
      });
      dialog.render(true);
    });
  }

  return await Dialog.wait({
    title, content, buttons, default: defaultButton
  }, options);
}

if (typeof window !== 'undefined' && typeof Hooks !== 'undefined' && !window.stowTreasureHookRegistered) {
    Hooks.on("renderChatMessage", (message, html, data) => {
        const collapseButton = html[0].querySelector('button[data-action="collapse-details"]');
        if (collapseButton) {
            collapseButton.addEventListener("click", (event) => {
                const detailsId = event.currentTarget.dataset.detailsId;
                const detailsElement = document.getElementById(detailsId);
                if (detailsElement) {
                    detailsElement.removeAttribute("open");
                }
            });
        }
    });
    window.stowTreasureHookRegistered = true;
}

dialogWaitShim({
    title: "Treasure Stowing Options",
    content: "<p>Choose how to fill character inventories:</p>",
    buttons: {
        lastStep: {
            label: "Half Encumbrance",
            callback: () => stowTreasure(false)
        },
        max: {
            label: "Max Encumbrance",
            callback: () => stowTreasure(true)
        }
    },
    defaultButton: "lastStep"
});

async function stowTreasure(fillToAbsoluteMax) {
    const getCapacityLimit = (actor) => {
        const isFloatingDisc = actor.system.details.class.includes("Floating Disc");
        const isMule = actor.system.details.class.includes("Mule");
        const useMax = isFloatingDisc || isMule || fillToAbsoluteMax;
        return useMax
            ? actor.system.encumbrance.max
            : actor.system.encumbrance.max * (actor.system.encumbrance.steps[actor.system.encumbrance.steps.length - 1] / 100);
    };

    const getAvailableCapacity = (actor) => {
        const max = getCapacityLimit(actor);
        return max - actor.system.encumbrance.value;
    };

    const selectedTokens = canvas.tokens.controlled;
    const selectedActors = selectedTokens.map(token => token.actor).filter(actor => actor?.type === 'character');

    // --- Data Collection for Final Report ---
    const report = {
        pileOrder: [],
        characterOrder: [],
        characterReports: [],
        pileSummary: [],
        selection: fillToAbsoluteMax ? "Max Encumbrance" : "Half Encumbrance"
    };

    console.log(`Selected actors: ${selectedActors.map(a => a.name).join(", ")}`);

    const itemPileActors = selectedActors.filter(actor => actor.flags["item-piles"]?.data?.enabled);
    if (itemPileActors.length === 0) {
        ui.notifications.warn("No item pile actors selected.");
        console.log("No item pile actors selected. Exiting script.");
        return;
    }

    itemPileActors.sort((a, b) => {
        const quantA = a.items.filter(isLootableItem).reduce((sum, i) => sum + (i.system.quantity?.value ?? 1), 0);
        const quantB = b.items.filter(isLootableItem).reduce((sum, i) => sum + (i.system.quantity?.value ?? 1), 0);
        return quantB - quantA;
    });
    report.pileOrder = itemPileActors.map(a => a.name);
    console.log(`Selected item piles in order: ${report.pileOrder.join(", ")}`);


    const selectedCharacters = selectedActors.filter(actor => !actor.flags["item-piles"]?.data?.enabled);
    if (!selectedCharacters.length) {
        ui.notifications.warn("No valid character actors selected to receive items.");
        console.log("No valid character actors selected to receive items. Exiting script.");
        return;
    }

    const classPrecedence = ["Floating Disc", "Mule", "Magic User"];
    const getClassPrecedence = (className) => {
        for (let i = 0; i < classPrecedence.length; i++) {
            if (className.includes(classPrecedence[i])) return i;
        }
        return classPrecedence.length;
    };

    selectedCharacters.sort((a, b) => {
        const classA = a.system.details.class;
        const classB = b.system.details.class;
        const pA = getClassPrecedence(classA);
        const pB = getClassPrecedence(classB);

        if (pA !== pB) {
            return pA - pB;
        }

        return getAvailableCapacity(b) - getAvailableCapacity(a);
    });
    report.characterOrder = selectedCharacters.map(a => a.name);
    console.log(`Selected characters in order: ${report.characterOrder.join(", ")}`);

    // Item Piles' transferItems returns one entry per moved row; item rows carry
    // an `item` payload (the created/updated embedded item) while currency rows
    // are shaped differently. We only post-process item rows, so guard for that
    // shape rather than the brittle "no `type` property" check used previously.
    const extractTransferredItems = (result) => {
        if (!Array.isArray(result)) return [];
        return result.filter(r => r && r.item && r.item._id);
    };

    for (const characterActor of selectedCharacters) {
        const isFloatingDisc = characterActor.system.details.class.includes("Floating Disc");
        const isMule = characterActor.system.details.class.includes("Mule");
        let actorRemainingCapacity = getAvailableCapacity(characterActor);
        const capacityLimit = getCapacityLimit(characterActor);

        const characterReport = {
            name: characterActor.name,
            startingCapacity: Math.round(actorRemainingCapacity),
            capacityLimit: Math.round(capacityLimit),
            isFloatingDisc: isFloatingDisc,
            isMule: isMule,
            messages: [],
            containerReports: new Map(),
            endingCapacity: 0,
            modifiedContainerNames: new Set()
        };
        console.log(`Processing character ${characterActor.name} with ${actorRemainingCapacity} cns total available capacity.`);

        if (actorRemainingCapacity <= 0) {
            console.log(`Actor ${characterActor.name} has no available capacity. Skipping.`);
            characterReport.messages.push(`<p>No available capacity. Skipping.</p>`);
            report.characterReports.push(characterReport);
            continue;
        }

        // Build the fillable-container list ONCE per character and track the
        // live remaining capacity on each entry. This is the source of truth for
        // the rest of the run: container.system.totalWeight is NOT refreshed
        // synchronously after a transfer, so re-reading it between piles would
        // double-count free space and overfill containers (the previous bug).
        const fillableContainers = [];
        for (const container of characterActor.system.containers) {
            const pattern = /^.*\(\s*(?<capacity>[\d,]+)\s*(?:cn|cns)?\s*\)\s*$/im;
            const matches = pattern.exec(container.name);
            if (matches) {
                const capacity = Number(matches.groups.capacity.replace(/,/g, ""));
                const remaining = capacity - container.system.totalWeight;
                if (remaining > 0) {
                    // A container "in use by normal items" holds at least one non-treasure item.
                    // These are filled only as a last resort (after all other free space is used).
                    const hasNormalItems = characterActor.items.some(i =>
                        i.system.containerId === container.id && i.system.treasure !== true);
                    fillableContainers.push({
                        item: container,
                        capacity: capacity,
                        remaining: remaining,
                        partiallyFilled: container.system.totalWeight > 0,
                        hasNormalItems: hasNormalItems
                    });
                }
            }
        }

        if (!fillableContainers.length) {
            console.log(`No fillable containers found on ${characterActor.name}.`);
            characterReport.messages.push(`<p>No fillable containers found. Skipping.</p>`);
        }

        // Order stow targets: containers holding normal (non-treasure) items last, then
        // partially-filled first, then tightest remaining capacity. (See helper for details.)
        fillableContainers.sort(compareFillableContainers);

        let itemsMovedForCharacter = false;

        // --- Pool All Items Across All Piles ---
        const pooledTreasure = [];
        for (const itemPileActor of itemPileActors) {
            const pileTreasure = itemPileActor.items.filter(isLootableItem);
            for (const item of pileTreasure) {
                pooledTreasure.push({ pile: itemPileActor, item: item });
            }
        }

        // Sort the entire pool by density
        pooledTreasure.sort((a, b) => compareTreasurePriority(
            { name: a.item.name, weight: a.item.system.weight, cost: a.item.system.cost, isTreasure: Boolean(a.item.system.treasure) },
            { name: b.item.name, weight: b.item.system.weight, cost: b.item.system.cost, isTreasure: Boolean(b.item.system.treasure) }
        ));

        const pileTransferLogs = new Map();

        for (const containerData of fillableContainers) {
            if (actorRemainingCapacity <= 0) break;

            const currentContainerItem = containerData.item;
            if (containerData.remaining <= 0) {
                characterReport.containerReports.set(currentContainerItem.id, { name: currentContainerItem.name, remaining: 0, capacity: containerData.capacity });
                continue;
            }

            const containerTransfersByPile = new Map();

            for (const poolEntry of pooledTreasure) {
                if (actorRemainingCapacity <= 0 || containerData.remaining <= 0) break;

                const { pile, item } = poolEntry;
                const itemOnPile = pile.items.get(item.id);
                if (!itemOnPile || (itemOnPile.system.quantity?.value ?? 1) === 0) continue;

                const itemWeight = itemOnPile.system.weight ?? 0;
                let quantityToMove = itemOnPile.system.quantity?.value ?? 1;

                if (itemWeight > 0) {
                    const afford = Math.min(Math.floor(containerData.remaining / itemWeight), Math.floor(actorRemainingCapacity / itemWeight));
                    if (afford <= 0) continue;
                    quantityToMove = Math.min(quantityToMove, afford);
                }

                if (quantityToMove > 0) {
                    if (!containerTransfersByPile.has(pile.id)) {
                        containerTransfersByPile.set(pile.id, { pileActor: pile, transferData: [] });
                    }
                    containerTransfersByPile.get(pile.id).transferData.push({ _id: itemOnPile.id, quantity: quantityToMove });
                    
                    const totalWeightToMove = quantityToMove * itemWeight;
                    actorRemainingCapacity -= totalWeightToMove;
                    containerData.remaining -= totalWeightToMove;
                    itemsMovedForCharacter = true;
                    
                    if (!pileTransferLogs.has(pile.name)) pileTransferLogs.set(pile.name, []);
                    pileTransferLogs.get(pile.name).push(`<li>Moved ${quantityToMove} of ${itemOnPile.name} to ${currentContainerItem.name}.</li>`);
                }
            }

            if (containerTransfersByPile.size > 0) {
                characterReport.modifiedContainerNames.add(currentContainerItem.id);
                for (const transferBatch of containerTransfersByPile.values()) {
                    console.log(`Transferring ${transferBatch.transferData.length} item stacks from ${transferBatch.pileActor.name} to container ${currentContainerItem.name}.`);
                    try {
                        const result = await game.itempiles.API.transferItems(transferBatch.pileActor, characterActor, transferBatch.transferData, {});
                        const updatedItems = extractTransferredItems(result)
                            .map(i => ({ _id: i.item._id, system: { containerId: currentContainerItem.id } }));
                        if (updatedItems.length > 0) {
                            await characterActor.updateEmbeddedDocuments("Item", updatedItems);
                        }
                    } catch (err) {
                        console.error(`Transfer to ${currentContainerItem.name} failed:`, err);
                        characterReport.messages.push(`<p><strong>Error:</strong> A transfer to ${currentContainerItem.name} failed and was skipped. See console.</p>`);
                    }
                }
            }
            characterReport.containerReports.set(currentContainerItem.id, {
                name: currentContainerItem.name,
                remaining: Math.round(containerData.remaining),
                capacity: containerData.capacity
            });
        }

        for (const [pileName, logs] of pileTransferLogs.entries()) {
            characterReport.messages.push(`<p><strong>From ${pileName}:</strong></p><ul>${logs.join('')}</ul>`);
        }

        // --- Handle leftover loose items for Floating Disc and Mule ---
        // These are carried loose on the actor. They are intentionally NOT assigned a
        // containerId and are excluded from container consolidation.
        if ((isFloatingDisc || isMule) && actorRemainingCapacity > 0) {
            const looseTransfersByPile = new Map();
            const looseTransferLogs = new Map();

            for (const poolEntry of pooledTreasure) {
                if (actorRemainingCapacity <= 0) break;
                
                const { pile, item } = poolEntry;
                const itemOnPile = pile.items.get(item.id);
                if (!itemOnPile || (itemOnPile.system.quantity?.value ?? 1) === 0) continue;

                const itemWeight = itemOnPile.system.weight ?? 0;
                let quantityToMove = itemOnPile.system.quantity?.value ?? 1;

                if (itemWeight > 0) {
                    const afford = Math.floor(actorRemainingCapacity / itemWeight);
                    if (afford <= 0) continue;
                    quantityToMove = Math.min(quantityToMove, afford);
                }

                if (quantityToMove > 0) {
                    if (!looseTransfersByPile.has(pile.id)) {
                        looseTransfersByPile.set(pile.id, { pileActor: pile, transferData: [] });
                    }
                    looseTransfersByPile.get(pile.id).transferData.push({ _id: itemOnPile.id, quantity: quantityToMove });
                    
                    const totalWeightToMove = quantityToMove * itemWeight;
                    actorRemainingCapacity -= totalWeightToMove;
                    itemsMovedForCharacter = true;
                    
                    if (!looseTransferLogs.has(pile.name)) looseTransferLogs.set(pile.name, []);
                    looseTransferLogs.get(pile.name).push(`<li>Moved ${quantityToMove} of loose item ${itemOnPile.name} directly to character.</li>`);
                }
            }
            
            for (const transferBatch of looseTransfersByPile.values()) {
                console.log(`Transferring ${transferBatch.transferData.length} loose item stacks from ${transferBatch.pileActor.name} to ${characterActor.name}.`);
                try {
                    await game.itempiles.API.transferItems(transferBatch.pileActor, characterActor, transferBatch.transferData, {});
                } catch (err) {
                    console.error(`Loose item transfer failed:`, err);
                    characterReport.messages.push(`<p><strong>Error:</strong> Loose item transfer failed and was skipped. See console.</p>`);
                }
            }

            for (const [pileName, logs] of looseTransferLogs.entries()) {
                characterReport.messages.push(`<p><strong>Loose items from ${pileName}:</strong></p><ul>${logs.join('')}</ul>`);
            }
        }

        if (itemsMovedForCharacter) {
            for (const containerId of characterReport.modifiedContainerNames) {
                const container = characterActor.items.get(containerId);
                if (container) {
                    await consolidateContainer(characterActor, container);
                }
            }
        }

        if (!itemsMovedForCharacter) {
            console.log(`Finished processing containers for ${characterActor.name}. No items moved.`);
            characterReport.messages.push(`<p>No items were moved for this character.</p>`);
        } else {
            console.log(`Finished processing containers for ${characterActor.name}.`);
        }
        // Now that all transfers for this character are done, get the official final capacity from the actor data
        const finalTrueCapacity = getAvailableCapacity(characterActor);
        characterReport.endingCapacity = Math.round(finalTrueCapacity);
        characterReport.modifiedContainerNames = Array.from(characterReport.modifiedContainerNames);
        report.characterReports.push(characterReport);
    }

    // --- Check remaining pile items ---
    for (const pile of itemPileActors) {
        const remainingItems = pile.items.filter(isLootableItem);
        if (remainingItems.length === 0) {
            report.pileSummary.push(`<p><strong>${pile.name}:</strong> All items have been taken.</p>`);
        } else {
            const remainingItemsList = remainingItems.map(i => `<li>${i.system.quantity?.value ?? 1} x ${i.name}</li>`);
            report.pileSummary.push(`<p><strong>${pile.name}:</strong> The following items remain:</p><ul>${remainingItemsList.join('')}</ul>`);
        }
    }

    // --- Presentation ---
    let summaryHeader = `<h4>Treasure Stowing Report</h4>`;
    summaryHeader += `<p><strong>Fill option selected:</strong> ${report.selection}</p>`;
    summaryHeader += `<p><strong>Piles:</strong> ${report.pileOrder.join(", ")}</p>`;
    summaryHeader += `<p><strong>Characters:</strong> ${report.characterOrder.join(", ")}</p>`;
    summaryHeader += `<hr><h4>Item Pile Summary</h4>`;
    summaryHeader += report.pileSummary.join('');

    const characterReportsHtml = report.characterReports.map(charReport => {
        let reportHtml = `<hr><h5>Processing ${charReport.name}</h5>`;
        if (charReport.isFloatingDisc) {
            reportHtml += `<p><i>Note: Floating Disc always fills to maximum capacity.</i></p>`;
        }
        if (charReport.isMule) {
            reportHtml += `<p><i>Note: Mule always fills to maximum capacity.</i></p>`;
        }
        reportHtml += `<p>Filling to: ${charReport.capacityLimit} cns</p>`;
        reportHtml += `<p>Starting capacity: ${charReport.startingCapacity} cns</p>`;
        reportHtml += charReport.messages.join('');

        if (charReport.modifiedContainerNames && charReport.modifiedContainerNames.length > 0) {
            reportHtml += '<h6>Container Capacity Summary:</h6><ul>';

            charReport.modifiedContainerNames.forEach(containerId => {
                const contReport = charReport.containerReports.get(containerId);
                if (contReport) {
                    const filled = contReport.capacity - contReport.remaining;
                    if (contReport.remaining > 0) {
                        reportHtml += `<li><strong>${contReport.name}:</strong> ${filled}/${contReport.capacity} cns.</li>`;
                    } else {
                        reportHtml += `<li><strong>${contReport.name}:</strong> Now full.</li>`;
                    }
                }
            });
            reportHtml += '</ul>';
        }
        reportHtml += `<p><strong>Final Character Capacity:</strong> ${charReport.endingCapacity} cns remaining.</p>`;
        return reportHtml;
    }).join('');

    const detailsId = `stow-report-${(foundry.utils?.randomID ?? randomID)()}`;
    const finalReport = `
        ${summaryHeader}
        <hr>
        <details id="${detailsId}">
            <summary>Detailed Report</summary>
            ${characterReportsHtml}
            <br>
            <button type="button" data-action="collapse-details" data-details-id="${detailsId}">Collapse Details</button>
        </details>
    `;

    ui.notifications.info("Treasure stowing complete!");

    ChatMessage.create({
        content: finalReport,
        whisper: ChatMessage.getWhisperRecipients("GM")
    });
}
