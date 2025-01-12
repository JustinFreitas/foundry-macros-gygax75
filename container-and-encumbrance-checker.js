const violations = [];
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true)
for (let i = 0; i < partySheetActors.length; i++) {
    const actor = partySheetActors[i];
    const containers = actor.system.containers;
    for (let j = 0; j < containers.length; j++) {
        const container = containers[j];
        const pattern = /^.*\(\s*(?<capacity>\d+)\s*\)\s*$/gm;
        const matches = pattern.exec(container.name);
        if (+matches?.groups?.capacity < container.system.totalWeight) {
            const violation = `<b>${actor.name}:</b> ${container.name}, Capacity: ${matches.groups.capacity}cns, Weight: ${container.system.totalWeight}cns`;
            console.log(violation);
            violations.push(violation);
        }
    }

    const treasures = actor.system.treasures;
    for (let j = 0; j < treasures.length; j++) {
        const treasure = treasures[j];
        if (!treasure.name.includes('(Bank)')) {
            const violation = `<b>${actor.name}:</b> has unstored treasure ${treasure.name}.`
            console.log(violation);
            violations.push(violation);
        }
    }

    if (actor.system.encumbrance.value > actor.system.encumbrance.max) {
        const violation = `<b>${actor.name}:</b> Over encumbered  ${actor.system.encumbrance.value}/${actor.system.encumbrance.max}.`
        console.log(violation);
        violations.push(violation);
    }
}

if (violations.length > 0) {
    ChatMessage.create({content: '<h2>Overfilled Container Report</h2><br/>' + violations.join('<br/><br/>')});
} else {
    ChatMessage.create({content: '<h2>Overfilled Container Report</h2><br/>No Storage or Treasure violations found in party.'});
}
