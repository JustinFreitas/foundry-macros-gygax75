// Clear Item Pile
// Clears all items from the selected Item Pile token(s).

const selectedTokens = canvas.tokens.controlled;

if (selectedTokens.length === 0) {
    ui.notifications.warn("No tokens selected. Please select at least one Item Pile token.");
    return;
}

const itemPiles = selectedTokens.filter(token => token.actor?.flags?.["item-piles"]?.data?.enabled);

if (itemPiles.length === 0) {
    ui.notifications.warn("No Item Pile actors selected.");
    return;
}

const { DialogV2 } = foundry.applications.api;
const dialog = new DialogV2({
    classes: ["dialog"],
    position: { width: 400, height: "auto" },
    window: { title: "Clear Item Piles" },
    content: `<p>Are you sure you want to clear all items from ${itemPiles.length} selected Item Pile(s)? This action cannot be undone.</p>`,
    buttons: [
        {
            action: "yes",
            label: "Clear Piles",
            callback: async (event, button, dialog) => {
                let clearedCount = 0;
                for (const token of itemPiles) {
                    const actor = token.actor;
                    const itemIds = actor.items.map(i => i.id);
                    
                    if (itemIds.length > 0) {
                        await actor.deleteEmbeddedDocuments("Item", itemIds);
                        clearedCount++;
                    }
                }
                ui.notifications.info(`Cleared items from ${clearedCount} Item Pile(s).`);
            }
        },
        {
            action: "no",
            label: "Cancel",
            default: true
        }
    ]
});
dialog.render(true);