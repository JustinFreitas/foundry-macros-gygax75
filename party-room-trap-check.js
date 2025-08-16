let partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true).filter(a => !['Riding Horse', 'War Horse', 'Mule'].includes(a.system.details.class));
const resultMap = new Map();
for (const actor of partySheetActors) {
    const chance = actor.system?.exploration?.ft || 1;
    const {result} = await new Roll('1d6').evaluate();
    resultMap.set(actor.name, {result, chance});
};

let content = '<h2>Party Room Trap Check</h2>'
if (resultMap.keys().toArray().length > 0) {
    const collatedResults = [];
    for (const actorName of resultMap.keys()) {
        const result = resultMap.get(actorName);
        const text = `roll: ${result.result} chance: ${result.chance}${result.result <= result.chance ? ' - <b>Found a room trap!</b>' : ''}`;
        collatedResults.push(`<b>${actorName}:</b>  ${text}<br/>`);
    };

    content = content + collatedResults.join('<br/>');
} else {
    content = `${content}<br/>No actors in the party to search!`;
}

await ChatMessage.create({
    content,
    whisper: [game.userId]
});
