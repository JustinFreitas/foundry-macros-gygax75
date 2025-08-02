function isWhiteListedTopLevelItem(item) {
    return item.name.startsWith('Case')
        || item.name.endsWith('Cloak')
        || item.name.startsWith('Gauntlets')
        || item.name.startsWith('Girdle')
        || item.name.startsWith('Helm')
        || item.name.startsWith('Medallion')
        || item.name.startsWith('Quiver')
        || item.name.startsWith('Ration')
        || item.name.startsWith('Rider')
        || item.name.endsWith('Ring')
        || item.name.startsWith('Ring')
        || [
            'Elven Cloak and Boots',
            'GP (Bank)',
            'Holy symbol',
            'Lantern',
            'Oil flask',
            'Saddle and Bridle',
            'Scarab of Protection',
            'Torch',
            'Waterskin'
            ].includes(item.name);
}

const nameToViolationsMap = new Map();
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
// Get partysheet actor mounts also for the container check.
const actorMounts = partySheetActors.filter(actor => actor.system.details.class !== 'Mule').flatMap(actor => {
    const baseActorName = actor.name.split('(')[0].trim();
    return game.actors.search({query: `(${baseActorName})`}).filter(a => ['Riding Horse', 'War Horse'].includes(a.system.details.class));
});

const partySheetActorsWithMounts = partySheetActors.concat(actorMounts);
for (let i = 0; i < partySheetActorsWithMounts.length; i++) {
    const actor = partySheetActorsWithMounts[i];
    const containers = actor.system.containers;
    for (let j = 0; j < containers.length; j++) {
        const container = containers[j];
        const pattern = /^.*\(\s*(?<capacity>\d+)\s*\)\s*$/gm;
        const matches = pattern.exec(container.name);
        if (+matches?.groups?.capacity < container.system.totalWeight) {
            const violation = `${container.name}, ${container.system.totalWeight}cns`;
            nameToViolationsMap.set(actor.name, [...nameToViolationsMap.get(actor.name) ? nameToViolationsMap.get(actor.name) : [], violation]);
        }
    }

    const treasures = actor.system.treasures;
    for (let j = 0; j < treasures.length; j++) {
        const treasure = treasures[j];
        if (!treasure.name.includes('(Bank)')) {
            const violation = `unstored treasure ${treasure.name}`;
            nameToViolationsMap.set(actor.name, [...nameToViolationsMap.get(actor.name) ? nameToViolationsMap.get(actor.name) : [], violation]);
        }
    }

    const foundItems = actor.items.filter(item => item.type === 'item'
                                            && !isWhiteListedTopLevelItem(item)
                                            && !item.system.containerId
                                            && !item.system.treasure);

    foundItems.forEach(item => {
        const violation = `misc item ${item.name}`;
        nameToViolationsMap.set(actor.name, [...nameToViolationsMap.get(actor.name) ? nameToViolationsMap.get(actor.name) : [], violation]);
    });

    if (actor.system.encumbrance.value > actor.system.encumbrance.max) {
        const violation = `over encumbered  ${actor.system.encumbrance.value}/${actor.system.encumbrance.max}`;
        nameToViolationsMap.set(actor.name, [...nameToViolationsMap.get(actor.name) ? nameToViolationsMap.get(actor.name) : [], violation]);
    }
}

if (nameToViolationsMap.keys().toArray().length > 0) {
    const collatedViolations = [];
    nameToViolationsMap.keys().forEach(actorName => {
        collatedViolations.push(`<b>${actorName}:</b>  ${nameToViolationsMap.get(actorName).sort().join(", ")}<br/>`);
    });

    ChatMessage.create({content: '<h2>Overfilled Container Report</h2>' + collatedViolations.join('<br/>')});
} else {
    ChatMessage.create({content: '<h2>Overfilled Container Report</h2><br/>No Storage or Treasure violations found in party.'});
}
