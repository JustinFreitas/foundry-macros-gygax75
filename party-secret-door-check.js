let partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true).filter(a => !['Riding Horse', 'War Horse', 'Mule'].includes(a.system.details.class));
const resultMap = new Map();
for (const actor of partySheetActors) {
    const secretDoorChance = actor.system?.exploration?.sd || 1;
    const {result} = await new Roll('1d6').evaluate();
    resultMap.set(actor.name, {result, secretDoorChance: secretDoorChance});
};

let content = '<h2>Party Secret Door Check</h2>'
if (resultMap.keys().toArray().length > 0) {
    const collatedResults = [];
    for (const actorName of resultMap.keys()) {
        const result = resultMap.get(actorName);
        const text = `roll: ${result.result} chance: ${result.secretDoorChance}${result.result <= result.secretDoorChance ? ' - <b>Found a secret door!</b>' : ''}`;
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
