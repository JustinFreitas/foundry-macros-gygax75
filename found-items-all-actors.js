const nameToItemsMap = new Map();
const nonItemPilesActors = game.actors.filter(
    (actor) => !actor.flags["item-piles"]?.data?.enabled
);
for (const actor of nonItemPilesActors) {
    const foundItems = actor.items.filter(
        (item) => item.type === "item" && item.name?.includes("(Found)")
    );
    for (const item of foundItems) {
        const found = `${item.system.quantity.value || 0} ${item.name}`;
        nameToItemsMap.set(actor.name, [
            ...(nameToItemsMap.get(actor.name) ?? []),
            found,
        ]);
    }
}

if (nameToItemsMap.keys().toArray().length > 0) {
    const collatedItems = [];
    for (const actorName of nameToItemsMap.keys()) {
        collatedItems.push(
            `<b>${actorName}:</b>  ${nameToItemsMap.get(actorName).sort().join(", ")}<br/>`
        );
    }

    ChatMessage.create({
        content: "<h4>Found Treasure Report</h4>" + collatedItems.join("<br/>"),
    });
} else {
    ChatMessage.create({
        content:
            "<h4>Found Treasure Report</h4><br/>No (Found) items in any actor.",
    });
}
