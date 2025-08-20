const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
// Get partysheet actor mounts also for the container check.
const actorMounts = partySheetActors.filter(actor => actor.system.details.class !== 'Mule').flatMap(actor => {
    const baseActorName = actor.name.split('(')[0].trim();
    return game.actors.search({query: `(${baseActorName})`}).filter(a => ['Riding Horse', 'War Horse'].includes(a.system.details.class));
});

const partySheetActorsWithMounts = partySheetActors.concat(actorMounts);
const nameToItemsMap = new Map();
for (const actor of partySheetActorsWithMounts) {
    const foundItems = actor.items.filter(item => item.type === 'item' && item.name.includes('(Found)'));
    for (const item of foundItems) {
        const found = `${item.system.quantity.value || 0} ${item.name}`;
        nameToItemsMap.set(actor.name, [...nameToItemsMap.get(actor.name) ? nameToItemsMap.get(actor.name) : [], found]);
    }   
}


if (nameToItemsMap.keys().toArray().length > 0) {
    const collatedItems = [];
    for (const actorName of nameToItemsMap.keys()) {
        collatedItems.push(`<b>${actorName}:</b>  ${nameToItemsMap.get(actorName).sort().join(", ")}<br/>`);
    }

    ChatMessage.create({content: '<h2>Found Treasure Report</h2>' + collatedItems.join('<br/>')});
} else {
    ChatMessage.create({content: '<h2>Found Treasure Report</h2><br/>No (Found) items in any actor.'});
}
