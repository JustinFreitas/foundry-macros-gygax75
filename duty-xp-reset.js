const actorLogs = [];
actorLogs.push('<h2>Duty Reset Report</h2>');

const gameActors = game.actors.filter(actor => actor.flags.dutyXP);
gameActors.forEach(actor => {
    if (actor.flags.dutyXP?.origXpBonus !== undefined) {
        console.log(`Actor ${actor.name} needs reset.  Updating from`, actor.system.details.xp.bonus);
        const systemObj = {
            details: {
                xp: {
                    bonus: actor.flags.dutyXP.origXpBonus 
                }
            }
        };
        console.log('Updating to', systemObj.details.xp.bonus);
        actorLogs.push(`<b>${actor.name}:</b> had their XP reset from ${actor.system.details.xp.bonus} back to the original of ${systemObj.details.xp.bonus} for duty ${actor.flags.dutyXP.duties.join(", ")}.`);
        actor.update({'flags.-=dutyXP': null, system: systemObj});

    }
});

if (gameActors.length === 0) {
    actorLogs.push('No characters in game needed duty reset.');
}

const chatMessage = actorLogs.join('<br/>');
ChatMessage.create({
    content: chatMessage,
});
