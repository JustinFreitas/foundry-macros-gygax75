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

new Dialog({
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
    default: "lastStep"
}).render(true);

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

    const activeScene = game.scenes.active;
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
        const quantA = a.items.filter(i => i.system.treasure === true).reduce((sum, i) => sum + i.system.quantity.value, 0);
        const quantB = b.items.filter(i => i.system.treasure === true).reduce((sum, i) => sum + i.system.quantity.value, 0);
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

        const fillableContainers = [];
        for (const container of characterActor.system.containers) {
            const pattern = /^.*\(\s*(?<capacity>\d+)\s*\)\s*$/gm;
            const matches = pattern.exec(container.name);
            if (matches) {
                const capacity = +matches.groups.capacity;
                if (capacity - container.system.totalWeight > 0) {
                    fillableContainers.push({ item: container, capacity: capacity });
                }
            }
        }

        if (!fillableContainers.length) {
            console.log(`No fillable containers found on ${characterActor.name}.`);
            characterReport.messages.push(`<p>No fillable containers found. Skipping.</p>`);
        }

        fillableContainers.sort((a, b) => {
            const aIsPartiallyFilled = a.item.system.totalWeight > 0;
            const bIsPartiallyFilled = b.item.system.totalWeight > 0;

            if (aIsPartiallyFilled && !bIsPartiallyFilled) {
                return -1;
            }
            if (!aIsPartiallyFilled && bIsPartiallyFilled) {
                return 1;
            }

            const aRemaining = a.capacity - a.item.system.totalWeight;
            const bRemaining = b.capacity - b.item.system.totalWeight;

            if (aIsPartiallyFilled && bIsPartiallyFilled) {
                return aRemaining - bRemaining;
            }

            return a.capacity - b.capacity;
        });

        let itemsMovedForCharacter = false;
        for (const itemPileActor of itemPileActors) {
            if (actorRemainingCapacity <= 0) break;

            console.log(`Character ${characterActor.name} is now taking from pile ${itemPileActor.name}.`);
            const precedence = ["Jewelry", "Gem", "PP", "GP", "EP", "SP", "CP"];
            const getPrecedence = (itemName) => {
                for (let i = 0; i < precedence.length; i++) {
                    if (itemName.includes(precedence[i])) return i;
                }
                return precedence.length;
            };

            const itemsToMove = itemPileActor.items
                .filter(item => item.system.treasure === true)
                .sort((a, b) => {
                    const pA = getPrecedence(a.name), pB = getPrecedence(b.name);
                    if (pA !== pB) return pA - pB;
                    return a.name.localeCompare(b.name);
                });

            if (!itemsToMove.length) {
                console.log(`Pile ${itemPileActor.name} has no treasure. Skipping.`);
                continue;
            }

            let pileTransferLog = { pileName: itemPileActor.name, log: [] };
            for (const containerData of fillableContainers) {
                if (actorRemainingCapacity <= 0) break;

                const currentContainerItem = containerData.item;
                let containerRemainingCapacity = containerData.capacity - currentContainerItem.system.totalWeight;
                if (containerRemainingCapacity <= 0) {
                    characterReport.containerReports.set(currentContainerItem.id, { name: currentContainerItem.name, remaining: 0, capacity: containerData.capacity });
                    continue;
                }

                const transferData = [];
                for (const item of itemsToMove) {
                    if (actorRemainingCapacity <= 0 || containerRemainingCapacity <= 0) break;

                    const itemOnPile = itemPileActor.items.get(item.id);
                    if (!itemOnPile || itemOnPile.system.quantity.value === 0) continue;

                    const itemWeight = itemOnPile.system.weight ?? 0;
                    let quantityToMove = itemOnPile.system.quantity.value;

                    if (itemWeight > 0) {
                        const afford = Math.min(Math.floor(containerRemainingCapacity / itemWeight), Math.floor(actorRemainingCapacity / itemWeight));
                        if (afford <= 0) continue;
                        quantityToMove = Math.min(quantityToMove, afford);
                    }

                    if (quantityToMove > 0) {
                        transferData.push({ _id: itemOnPile.id, quantity: quantityToMove });
                        const totalWeightToMove = quantityToMove * itemWeight;
                        actorRemainingCapacity -= totalWeightToMove;
                        containerRemainingCapacity -= totalWeightToMove;
                        itemsMovedForCharacter = true;
                        pileTransferLog.log.push(`<li>Moved ${quantityToMove} of ${itemOnPile.name} to ${currentContainerItem.name}.</li>`);
                    }
                }

                if (transferData.length > 0) {
                    characterReport.modifiedContainerNames.add(currentContainerItem.id);
                    console.log(`Transferring ${transferData.length} item stacks to container ${currentContainerItem.name}.`);
                    const updatedItemsFromApi = await game.itempiles.API.transferItems(itemPileActor, characterActor, transferData, {});
                    const updatedItems = updatedItemsFromApi.filter(i => !i.hasOwnProperty('type')).map(i => ({ _id: i.item._id, system: { containerId: currentContainerItem.id } }));
                    await characterActor.updateEmbeddedDocuments("Item", updatedItems);
                }
                characterReport.containerReports.set(currentContainerItem.id, {
                    name: currentContainerItem.name,
                    remaining: Math.round(containerRemainingCapacity),
                    capacity: containerData.capacity
                });
            }
            if(pileTransferLog.log.length > 0){
                characterReport.messages.push(`<p><strong>From ${pileTransferLog.pileName}:</strong></p><ul>${pileTransferLog.log.join('')}</ul>`);
            }
        }

        // --- Handle leftover large items for Floating Disc and Mule ---
        if (isFloatingDisc || isMule) {
            if (actorRemainingCapacity > 0) {
                for (const itemPileActor of itemPileActors) {
                    const maxContainerCapacity = fillableContainers.reduce((max, c) => Math.max(max, c.capacity), 0);
                    const largeItems = itemPileActor.items
                        .filter(item => item.system.treasure === true && item.system.weight > 0 && item.system.weight > maxContainerCapacity);

                    for (const item of largeItems) {
                        if (actorRemainingCapacity <= 0) break;

                        const itemOnPile = itemPileActor.items.get(item.id);
                        if (!itemOnPile || itemOnPile.system.quantity.value === 0) continue;

                        const itemWeight = itemOnPile.system.weight;
                        const afford = Math.floor(actorRemainingCapacity / itemWeight);
                        if (afford <= 0) continue;

                        const quantityToMove = Math.min(itemOnPile.system.quantity.value, afford);

                        if (quantityToMove > 0) {
                            const transferData = [{ _id: itemOnPile.id, quantity: quantityToMove }];
                            const totalWeightToMove = quantityToMove * itemWeight;
                            
                            console.log(`Transferring ${quantityToMove} of large item ${itemOnPile.name} directly to ${characterActor.name}.`);
                            const updatedItemsFromApi = await game.itempiles.API.transferItems(itemPileActor, characterActor, transferData, {});
                            
                            if (updatedItemsFromApi.length > 0) {
                                actorRemainingCapacity -= totalWeightToMove;
                                itemsMovedForCharacter = true;
                                characterReport.messages.push(`<p>Moved ${quantityToMove} of large item ${itemOnPile.name} directly to character.</p>`);
                            }
                        }
                    }
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
        const remainingTreasure = pile.items.filter(i => i.system.treasure === true);
        if (remainingTreasure.length === 0) {
            report.pileSummary.push(`<p><strong>${pile.name}:</strong> All treasure has been taken.</p>`);
        } else {
            const remainingItemsList = remainingTreasure.map(i => `<li>${i.system.quantity.value} x ${i.name}</li>`);
            report.pileSummary.push(`<p><strong>${pile.name}:</strong> The following treasure remains:</p><ul>${remainingItemsList.join('')}</ul>`);
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

    const detailsId = `stow-report-${randomID()}`;
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
