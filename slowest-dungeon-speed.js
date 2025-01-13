const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const speedToActorMap = new Map();
partyActors.forEach(actor => {
    const actorSpeed = actor.system.movement.base;
    const charsWithSpeed = speedToActorMap.get(actorSpeed) || [];
    speedToActorMap.set(actorSpeed, [actor, ...charsWithSpeed].sort((a, b) => ('' + a.name).localeCompare('' + b.name)));
});

const slowestSpeed = Math.min(...speedToActorMap.keys());
const actorsWithSlowestSpeed = speedToActorMap.get(slowestSpeed);
const output = `The party's slowest speed is ${slowestSpeed}.<br/><br/>Characters: ${actorsWithSlowestSpeed.map(a => a.name).join(", ")}`;
ChatMessage.create({content: '<h2>Slowest Dungeon Speed</h2>' + output});
