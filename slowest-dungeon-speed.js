function getSpeed(animal, fastRate, slowRate) {
    return animal.system.encumbrance.value > animal.system.encumbrance.max ? 0
        : animal.system.encumbrance.value <= (animal.system.encumbrance.max / 2) ? fastRate : slowRate;
}

const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const speedToActorMap = new Map();
partyActors.forEach(actor => {
    let actorSpeed;
    if (actor.system.details.class === 'Mule') {
        actorSpeed = getSpeed(actor, 120, 60);
        actor.update({system: {movement: {base: actorSpeed}}});
     } else {
        actorSpeed = actor.system.movement.base;
     } 

    const charsWithSpeed = speedToActorMap.get(actorSpeed) || [];
    speedToActorMap.set(actorSpeed, [actor, ...charsWithSpeed].sort((a, b) => ('' + a.name).localeCompare('' + b.name)));
});

const slowestSpeed = Math.min(...speedToActorMap.keys());
const actorsWithSlowestSpeed = speedToActorMap.get(slowestSpeed);
const output = `The party's slowest speed is <b>${slowestSpeed}ft</b> / <b>${slowestSpeed/5} miles</b> per turn.<br/><br/>Characters: ${actorsWithSlowestSpeed.map(a => a.name).join(", ")}`;
ChatMessage.create({content: '<h2>Character Speed Report</h2>' + output});
