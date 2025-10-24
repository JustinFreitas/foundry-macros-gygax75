function isWhiteListedTopLevelItem(item) {
    return item.name.startsWith('Case')
        || item.name.endsWith('Cloak')
        || item.name.startsWith('Gauntlets')
        || item.name.startsWith('Girdle')
        || item.name.startsWith('Helm')
        || item.name.startsWith('Medallion')
        || item.name.startsWith('Quiver')
        || item.name.endsWith('Ring')
        || item.name.startsWith('Ring')
        || [
            'Elven Cloak and Boots',
            'GP (Bank)',
            'Holy symbol',
            'Lantern',
            'Oil flask',
            'Scarab of Protection',
            'Torch',
            'Waterskin'
            ].includes(item.name);
}

const allMiscItems = [];
game.actors.filter(actor =>
                    actor.type === 'character'
                    && actor.flags.ose?.party
                    && !actor.flags['item-piles']?.data?.enabled
                    && !actor.name.endsWith(' Chest')
                    && !['Mule', 'Draft Horse', 'Riding Horse', 'War Horse'].includes(actor.system.details.class))
           .forEach(actor => {
                const foundItems = actor.items.filter(item => item.type === 'item'
                                                        && !isWhiteListedTopLevelItem(item)
                                                        && !item.system.containerId);
                foundItems.forEach(item => {
                    const found = `<b>${actor.name}:</b> ${item.name}`;
                    console.log(found);
                    allMiscItems.push(found);
           });
});

if (allMiscItems.length > 0) {
    ChatMessage.create({content: '<h2>Misc Items Report</h2><br/>' + allMiscItems.join('<br/><br/>')});
} else {
    ChatMessage.create({content: '<h2>Misc Items Report</h2><br/>No unallowed Misc items in any party actor.'});
}
