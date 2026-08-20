(async () => {
    // This macro transfers all (Found) items from selected tokens to an item pile on the active scene.

    const selectedTokens = canvas.tokens.controlled;

    if (!selectedTokens || selectedTokens.length === 0) {
        ui.notifications.info("No tokens selected.");
        return;
    }

    // 1. Identify the destination item pile.
    // Check if an item pile is included in the current selection first.
    const selectedPileTokens = selectedTokens.filter(t => t.actor?.flags["item-piles"]?.data?.enabled);

    let itemPileActor = null;

    if (selectedPileTokens.length === 1) {
        itemPileActor = selectedPileTokens[0].actor;
    } else if (selectedPileTokens.length > 1) {
        ui.notifications.warn(`Expected at most 1 item pile in selection, but found ${selectedPileTokens.length}.`);
        return;
    } else {
        // If no item pile is selected, search the active scene
        const scenePileTokens = canvas.scene.tokens.filter(t => t.actor?.flags["item-piles"]?.data?.enabled);
        if (scenePileTokens.length !== 1) {
            ui.notifications.warn(`Expected 1 item pile on the scene, but found ${scenePileTokens.length}.`);
            return;
        }
        itemPileActor = scenePileTokens[0].actor;
    }

    // 2. Identify source actors from selected tokens (excluding item piles and de-duplicating)
    const sourceActors = [];
    const seenActorIds = new Set();

    for (const token of selectedTokens) {
        const actor = token.actor;
        if (actor && actor.id !== itemPileActor.id && !actor.flags["item-piles"]?.data?.enabled) {
            if (!seenActorIds.has(actor.id)) {
                seenActorIds.add(actor.id);
                sourceActors.push(actor);
            }
        }
    }

    if (sourceActors.length === 0) {
        ui.notifications.info("No valid character tokens selected to transfer items from.");
        return;
    }

    let chatMessage = `<h2>Item Transfer to ${itemPileActor.name}</h2>`;
    let itemsTransferred = false;

    for (const member of sourceActors) {
        // Filter for found items and collect details
        const itemsToTransferDetails = member.items
            .filter(item => item.name.includes("(Found)"))
            .map(item => ({
                _id: item.id,
                name: item.name,
                quantity: item.system?.quantity?.value ?? 1
            }));

        const itemsToTransfer = itemsToTransferDetails.map(item => ({ _id: item._id, quantity: item.quantity }));

        if (itemsToTransfer.length > 0) {
            await game.itempiles.API.transferItems(member, itemPileActor, itemsToTransfer);
            console.log(`Transferred ${itemsToTransfer.length} item stacks from ${member.name} to ${itemPileActor.name}.`);

            let itemList = '<ul>';
            for (const item of itemsToTransferDetails) {
                itemList += `<li>${item.quantity} x ${item.name}</li>`;
            }
            itemList += '</ul>';
            chatMessage += `<p>Transferred the following from <b>${member.name}</b>:</p>${itemList}`;

            itemsTransferred = true;
        } else {
            chatMessage += `<p>No (Found) items to transfer from <b>${member.name}</b>.</p>`;
        }
    }

    if (itemsTransferred) {
        ui.notifications.info("Item transfer complete!");
    } else {
        ui.notifications.info("No items were transferred.");
    }

    ChatMessage.create({
        content: chatMessage,
        whisper: ChatMessage.getWhisperRecipients("GM")
    });
})();
