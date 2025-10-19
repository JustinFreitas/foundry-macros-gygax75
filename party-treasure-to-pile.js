// This macro transfers all treasure items from party members to a single item pile on the active scene.

// 1. Find the item pile on the active scene.
const itemPileTokens = canvas.scene.tokens.filter(token => token.actor && token.actor.flags["item-piles"]?.data?.enabled);

if (itemPileTokens.length !== 1) {
  ui.notifications.warn(`Expected 1 item pile on the scene, but found ${itemPileTokens.length}.`);
  return;
}

const itemPileActor = itemPileTokens[0].actor;

// 2. Get party members.
const partyMembers = game.actors.filter(actor => actor.flags.ose?.party === true);

if (partyMembers.length === 0) {
    ui.notifications.info("No party members found.");
    return;
}

let chatMessage = `<h2>Item Transfer to ${itemPileActor.name}</h2>`;
let itemsTransferred = false;

(async () => {
    for (const member of partyMembers) {
        // Filter for found items and collect details
        const itemsToTransferDetails = member.items
            .filter(item => item.name.includes("(Found)"))
            .map(item => ({
                _id: item.id,
                name: item.name,
                quantity: item.system.quantity.value
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
