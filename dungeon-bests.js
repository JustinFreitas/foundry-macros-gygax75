const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true && actor.system.details.class !== 'Mule');
const actorLogs = [];
actorLogs.push('<h2>Dungeon Bests Report</h2>');

const listenDoorValueToNameArrayMap = new Map();
const openDoorValueToNameArrayMap = new Map();
const secretDoorValueToNameArrayMap = new Map();
const findTrapsValueToNameArrayMap = new Map();

for (const actor of partyActors) {
    listenDoorValueToNameArrayMap.set(actor.system.exploration.ld || 0, [actor.name, ...(listenDoorValueToNameArrayMap.get(actor.system.exploration.ld || 0) || [])]);
    openDoorValueToNameArrayMap.set(actor.system.exploration.od || 0, [actor.name, ...(openDoorValueToNameArrayMap.get(actor.system.exploration.od || 0) || [])]);
    secretDoorValueToNameArrayMap.set(actor.system.exploration.sd || 0, [actor.name, ...(secretDoorValueToNameArrayMap.get(actor.system.exploration.sd || 0) || [])]);
    findTrapsValueToNameArrayMap.set(actor.system.exploration.ft || 0, [actor.name, ...(findTrapsValueToNameArrayMap.get(actor.system.exploration.ft || 0) || [])]);
}

if (partyActors.length === 0) {
    actorLogs.push('No party members to check for best abilities.');
} else {
    const listenDoorsMaxValue = Math.max(...listenDoorValueToNameArrayMap.keys().toArray());
    actorLogs.push(`<b>Listen Doors:</b> ${Math.max(...listenDoorValueToNameArrayMap.keys().toArray())} - ${listenDoorValueToNameArrayMap.get(listenDoorsMaxValue).sort().join(", ")}<br/>`);
    const openDoorsMaxValue = Math.max(...openDoorValueToNameArrayMap.keys().toArray());
    actorLogs.push(`<b>Open Doors:</b> ${Math.max(...openDoorValueToNameArrayMap.keys().toArray())} - ${openDoorValueToNameArrayMap.get(openDoorsMaxValue).sort().join(", ")}<br/>`);
    const secretDoorsMaxValue = Math.max(...secretDoorValueToNameArrayMap.keys().toArray());
    actorLogs.push(`<b>Secret Doors:</b> ${Math.max(...secretDoorValueToNameArrayMap.keys().toArray())} - ${secretDoorValueToNameArrayMap.get(secretDoorsMaxValue).sort().join(", ")}<br/>`);
    const findTrapsMaxValue = Math.max(...findTrapsValueToNameArrayMap.keys().toArray());
    actorLogs.push(`<b>Find Traps:</b> ${Math.max(...findTrapsValueToNameArrayMap.keys().toArray())} - ${findTrapsValueToNameArrayMap.get(findTrapsMaxValue).sort().join(", ")}<br/>`);
}

const chatMessage = actorLogs.join('<br/>');
ChatMessage.create({
    content: chatMessage,
});
