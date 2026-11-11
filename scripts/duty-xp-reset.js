(async () => {
    const actorLogs = [];
    actorLogs.push('<h2>Duty Reset Report</h2>');

    const gameActors = game.actors.filter(actor => actor.flags.dutyXP);
    const updates = [];
    gameActors.forEach(actor => {
        if (actor.flags.dutyXP?.origXpBonus !== undefined) {
            const systemObj = {
                details: {
                    xp: {
                        bonus: actor.flags.dutyXP.origXpBonus 
                    }
                }
            };
            actorLogs.push(`<b>${actor.name}:</b> had their XP reset from ${actor.system.details.xp.bonus} back to the original of ${systemObj.details.xp.bonus} for duty ${actor.flags.dutyXP.duties.join(", ")}.`);
            updates.push(actor.update({'flags.-=dutyXP': null, system: systemObj}));
        }
    });

    await Promise.all(updates);

    if (gameActors.length === 0) {
        actorLogs.push('No characters in game needed duty reset.');
    }

    const chatMessage = actorLogs.join('<br/>');
    await ChatMessage.create({
        content: chatMessage,
    });
})();
