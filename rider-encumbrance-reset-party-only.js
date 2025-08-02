function resetItemToZero(item) {
    item.update({system: {quantity: {value: 0}}});
}

const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const actorMounts = partyActors.filter(actor => actor.system.details.class !== 'Mule').flatMap(actor => {
    const baseActorName = actor.name.split('(')[0].trim();
    return game.actors.search({query: `(${baseActorName})`}).filter(a => ['Riding Horse', 'War Horse'].includes(a.system.details.class));
});

const actorLogs = []
actorLogs.push('<h2>Rider Encumbrance Reset Report</h2>');
actorMounts.forEach(async animal => {
    const ridersEncumbranceItems = animal.items.filter(item => {
        return item.name === 'Riders Encumbrance';
    });

    if (ridersEncumbranceItems.length === 0) {
        let itemClone = game.items.getName('Riders Encumbrance');
        if (!itemClone) {
            itemClone = {
                name: 'Riders Encumbrance',
                type: 'item',
                system: {
                    weight: 1
                }
            };
        }

        await animal.createEmbeddedDocuments('Item', [itemClone]);
        await animal.items.getName('Riders Encumbrance').update({system: {quantity: {value: 0}}});
        actorLogs.push(`<b>${animal.name}:</b> didn't have a Rider Encumbrance item so one was added and set to <b>0</b>.<br/>`);
    } else if (ridersEncumbranceItems.length > 1) {
        ridersEncumbranceItems.forEach((item, index) => {
            if (index === 0) {
                resetItemToZero(item);
            } else {
                item.delete();
            }
        });

        actorLogs.push(`<b>${animal.name}:</b> had too many Rider Encumbrance items so all but one were removed and it was set to <b>0</b>.<br/>`);
    } else {
        const origItemEncumbrance = ridersEncumbranceItems[0].system.quantity.value || 0;
        if (origItemEncumbrance !== 0) {
            resetItemToZero(ridersEncumbranceItems[0]);
            actorLogs.push(`<b>${animal.name}:</b> had its Rider Encumbrance item reset to <b>0</b> from <b>${origItemEncumbrance}</b>.<br/>`);
        }
    }

    const nonDefaultItems = animal.items.filter(i => !['Saddle Bags (1000)', 'Rider', 'Small Sized Rider', 'Riders Encumbrance', 'Saddle and Bridle'].includes(i.name));
    if (nonDefaultItems.length > 0) {
        actorLogs.push(`<b>${animal.name}:</b> has non-default items that need to be cleaned up.<br/>`);
    }
});

if (actorLogs.length === 1) {
    actorLogs.push('No rideable animals needed reset.');
}

const chatMessage = actorLogs.join('<br/>');
ChatMessage.create({
    content: chatMessage,
});
