new Dialog({
    title: "Delete Found Items",
    content: "<p>Are you sure you want to delete found items for all non-item pile actors? This action cannot be undone.</p>",
    buttons: {
        yes: {
            label: "Yes, delete them",
            callback: async () => {
                const nonItemPilesActors = canvas.tokens.controlled
                    .map(token => token.actor)
                    .filter(actor => actor && !actor.flags["item-piles"]?.data?.enabled);

                if (nonItemPilesActors.length === 0) {
                    ui.notifications.info("No actors selected or none of the selected actors have item piles disabled.");
                } else {
                    let deletedItems = [];
                    for (const actor of nonItemPilesActors) {
                        const itemsToDelete = actor.items.filter(item => item.name.includes("(Found)"));
                        if (itemsToDelete.length > 0) {
                            const itemIdsToDelete = itemsToDelete.map(item => item.id);
                            const deletedItemNames = itemsToDelete.map(item => item.name);
                            await actor.deleteEmbeddedDocuments("Item", itemIdsToDelete);
                            deletedItems.push(`<b>${actor.name}:</b> ${deletedItemNames.join(", ")}`);
                        }
                    }

                    if (deletedItems.length > 0) {
                        ChatMessage.create({
                            content: "<h4>Deleted (Found) Items</h4>" + deletedItems.join("<br/>"),
                        });
                    } else {
                        ui.notifications.info("No (Found) items to delete for the selected actors.");
                    }
                }
            }
        },
        no: {
            label: "No, cancel"
        }
    },
    default: "no"
}).render(true);
