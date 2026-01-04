let partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
let bestChance = 0;
let bestActorName = 'None';

for (const actor of partySheetActors) {
    let chance = actor.system?.exploration?.sd || 1;
    if (actor.system?.details?.class === 'Elf') {
        chance = Math.max(chance, 3);
    }
    if (chance > bestChance) {
        bestChance = chance;
        bestActorName = actor.name;
    }
}

if (partySheetActors.length === 0) {
    ui.notifications.warn("No actors in the party to search!");
} else {
    const { result } = await new Roll('1d6').evaluate();
    const success = result <= bestChance;

    let content = `<h2>Party Secret Door Check</h2>`;
    content += `<b>Rolled:</b> ${result} vs target ${bestChance} (Best: ${bestActorName})<br/>`;

    if (success) {
        content += `<b>RESULT: Secret Door Found!</b>`;
        // game.togglePause(true, true);
    } else {
        content += `RESULT: Secret Door Not Found.`;
    }

    await ChatMessage.create({
        content,
        whisper: ChatMessage.getWhisperRecipients("GM")
    });
}
