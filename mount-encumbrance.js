function getSpeed(animal, fastRate, slowRate) {
    return animal.system.encumbrance.value > animal.system.encumbrance.max ? 0
        : animal.system.encumbrance.value <= (animal.system.encumbrance.max / 2) ? fastRate : slowRate;
}

const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const updatedAnimalSpeeds = [];
let slowestSpeed = 240;
partyActors.forEach(actor => {
    const baseActorName = actor.name.split('(')[0].trim();
    const actorBeastsOfBurden = game.actors.search({query: `(${baseActorName})`}).filter(a => ['Mule', 'Draft Horse'].includes(a.system.details.class));
    const actorRidingMounts = game.actors.search({query: `(${baseActorName})`}).filter(a => ['Riding Horse', 'War Horse'].includes(a.system.details.class));
    const actorAnimals = actorRidingMounts.concat(actorBeastsOfBurden);
    if (actorRidingMounts.length > 1) {
        updatedAnimalSpeeds.push(`<b>${baseActorName} - More than one riding mount found -</b> ${actorRidingMounts.map(a => a.name).join(", ")}.`);
    }

    actorAnimals.forEach(animal => {
        let speed = 0;
        switch (animal.system.details.class) {
            case 'Riding Horse':
                speed = getSpeed(animal, 240, 120);
                break;
            case 'Mule':
                speed = getSpeed(animal, 120, 60);
                break;
            case 'War Horse':
                speed = getSpeed(animal, 120, 60);
                break;
            case 'Draft Horse':
                speed = getSpeed(animal, 90, 45);
                break;
        }

        slowestSpeed = Math.min(slowestSpeed, speed);
        animal.update({system: {movement: {base: speed}}});
        updatedAnimalSpeeds.push(`<b>${animal.name} - ${animal.system.details.class}:</b> Encumbrance is ${animal.system.encumbrance.value}/${animal.system.encumbrance.max}cns, movement is ${speed}'.`);
    });
});

if (updatedAnimalSpeeds.length > 0) {
    const slowestSpeedInMiles = slowestSpeed / 5;
    ChatMessage.create({content: '<h2>Animal Speed Updates</h2><br/>' + updatedAnimalSpeeds.join('<br/>' + `<br/>`) + `<br/><br/><b>Slowest speed is ${slowestSpeed}' / ${slowestSpeedInMiles} miles.</b>`});
} else {
    ChatMessage.create({content: '<br/>No animal speeds were updated.'});
}
