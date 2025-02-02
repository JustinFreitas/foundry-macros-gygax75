const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const actorLogs = []
actorLogs.push('<h2>Rider Encumbrance Report</h2>');
partyActors.forEach(actor => {
    // Check if actor has a horse.
    const baseActorName = actor.name.split('(')[0].trim();
    const actorRidingMounts = game.actors.search({query: `(${baseActorName})`}).filter(a => ['Riding Horse', 'War Horse'].includes(a.system.details.class));
    if (actorRidingMounts.length > 1) {
        actorLogs.push(`<b>${baseActorName} - More than one riding mount found -</b> ${actorRidingMounts.map(a => a.name).join(", ")}.<br/>`);
    }

    actorRidingMounts.forEach(animal => {
        const ridersEncumbranceItems = animal.items.filter(item => {
            return item.name === 'Riders Encumbrance';
        });

        if (ridersEncumbranceItems.length === 0) {
            console.log(`${animal.name} doesn't have a Riders Encumbrance item.`);
            actorLogs.push(`<b>${animal.name} doesn't have a Riders Encumbrance item.<br/>`);
        } else if (ridersEncumbranceItems.length > 1) {
            console.log(`${animal.name} has too many Riders Encumbrance items.`);
            actorLogs.push(`<b>${animal.name} has too many Riders Encumbrance items.<br/>`);
        } else {
            const actorEncumbrance = actor.system.encumbrance.value;
            const origItemEncumbrance = ridersEncumbranceItems[0].system.quantity.value;
            console.log(`${actor.name} encumbrance is ${actorEncumbrance}.  Animal ${animal.name} current encumbrance:`, origItemEncumbrance || undefined);
            ridersEncumbranceItems[0].update({system: {quantity: {value: actorEncumbrance}}});
            actorLogs.push(`<b>${animal.name}:</b> had its Rider Encumbrance item set to <b>${actorEncumbrance}</b> from <b>${origItemEncumbrance}</b>.<br/>`);
        }
    });

});

const chatMessage = actorLogs.join('<br/>');
ChatMessage.create({
    content: chatMessage,
});
