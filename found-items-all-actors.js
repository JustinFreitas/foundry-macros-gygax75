const nameToItemsMap = new Map();
game.actors.filter(actor => !actor.flags['item-piles']?.data?.enabled)
           .forEach(actor => {
                const foundItems = actor.items.filter(item => item.type === 'item' && item.name.includes('(Found)'));
                foundItems.forEach(item => {
                    const found = `${item.system.quantity.value || 0} ${item.name}`;
                    nameToItemsMap.set(actor.name, [...nameToItemsMap.get(actor.name) ? nameToItemsMap.get(actor.name) : [], found]);
                });
            });

if (nameToItemsMap.keys().toArray().length > 0) {
    const collatedItems = [];
    nameToItemsMap.keys().forEach(actorName => {
        collatedItems.push(`<b>${actorName}:</b>  ${nameToItemsMap.get(actorName).sort().join(", ")}<br/>`);
    });

    ChatMessage.create({content: '<h2>Found Treasure Report</h2>' + collatedItems.join('<br/>')});
} else {
    ChatMessage.create({content: '<h2>Found Treasure Report</h2><br/>No (Found) items in any actor.'});
}
