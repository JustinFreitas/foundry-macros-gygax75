function resetItemToZero(item) {
    item.update({system: {quantity: {value: 0}}});
}

const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const actorLogs = []
actorLogs.push('<h2>Rider Encumbrance Reset Report</h2>');
const allAnimals = game.actors.filter(a => ['Riding Horse', 'War Horse', 'Draft Horse'].includes(a.system.details.class));
allAnimals.forEach(async animal => {
    const ridersEncumbranceItems = animal.items.filter(item => {
        return item.name === 'Riders Encumbrance';
    });

    if (ridersEncumbranceItems.length === 0) {
        console.log(`${animal.name} doesn't have a Riders Encumbrance item.`);
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

        console.log(itemClone);
        await animal.createEmbeddedDocuments('Item', [itemClone]);
        await animal.items.getName('Riders Encumbrance').update({system: {quantity: {value: 0}}});

    } else if (ridersEncumbranceItems.length > 1) {
        console.log(`${animal.name} has too many Riders Encumbrance items, resetting all to zero.`);
        ridersEncumbranceItems.forEach((item, index) => {
            if (index === 0) {
                resetItemToZero(item);
            } else {
                item.delete();
            }
        });
    } else {
        const origItemEncumbrance = ridersEncumbranceItems[0].system.quantity.value || 0;
        console.log(`Animal ${animal.name} encumbrance before resetting to zero:`, origItemEncumbrance);
        resetItemToZero(ridersEncumbranceItems[0]);
        actorLogs.push(`<b>${animal.name}:</b> had its Rider Encumbrance item reset to <b>0</b> from <b>${origItemEncumbrance}</b>.`);
    }
});

// const chatMessage = actorLogs.join('<br/>');
// ChatMessage.create({
//     content: chatMessage,
// });
