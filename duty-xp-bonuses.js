if (document?.getElementById('duty-xp-bonuses')) {
    console.log('Duty XP Bonuses Window Already Open');
} else {
    const users = game.users.filter(user => user.hasPlayerOwner);
    const formHtml = [];
    formHtml.push(`
<form id="duty-xp-bonuses">
    <div class="form-group">
        <label>Request User</label>
        <select id="request-user-select">
`);

    users.forEach(user => {
                    formHtml.push(`
            <option value="${user.id}">${user.name}</option>
               `);
    });

    formHtml.push(`
        </select>
    </div>

    <div class="form-group">
        <label>Caller User</label>
        <select id="caller-user-select">
`);

users.forEach(user => {
    formHtml.push(`
            <option value="${user.id}">${user.name}</option>
    `);
});

formHtml.push(`
    </select>
</div>

<div class="form-group">
    <label>Mapper User</label>
        <select id="mapper-user-select">
`);

users.forEach(user => {
    formHtml.push(`
            <option value="${user.id}">${user.name}</option>
    `);
});

formHtml.push(`
        </select>
    </div>
`);

formHtml.push(`
</form>
`);

    new Dialog({
        title: "Duty XP Bonuses",
        content: formHtml.join('\n'),
        buttons: {
            calculate: {
                label: "Apply Bonuses",
                callback: (html) => {
                    const requestUserSelectElement = document.getElementById('request-user-select');
                    console.log(`Request User Name: ${requestUserSelectElement.options[requestUserSelectElement.selectedIndex].text}  User ID: ${requestUserSelectElement.value}`);
                    const callerUserSelectElement = document.getElementById('caller-user-select');
                    console.log(`Caller User Name: ${callerUserSelectElement.options[callerUserSelectElement.selectedIndex].text}  User ID: ${callerUserSelectElement.value}`);
                    const mapperUserSelectElement = document.getElementById('mapper-user-select');
                    console.log(`Mapper User Name: ${mapperUserSelectElement.options[mapperUserSelectElement.selectedIndex].text}  User ID: ${mapperUserSelectElement.value}`);
                    const selectedPlayersSet = new Set([
                        requestUserSelectElement.options[requestUserSelectElement.selectedIndex].text,
                        callerUserSelectElement.options[callerUserSelectElement.selectedIndex].text,
                        mapperUserSelectElement.options[mapperUserSelectElement.selectedIndex].text
                    ]);
                    
                    const selectedPlayers = [...selectedPlayersSet];
                    const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
                    const actorLogs = [];
                    actorLogs.push('<h2>Duty XP Report</h2>');
                    partyActors.forEach(actor => {
                        if (actor.ownership[requestUserSelectElement.value] === 3 || actor.ownership[callerUserSelectElement.value] === 3 || actor.ownership[mapperUserSelectElement.value] === 3) {
                            console.log(`Actor needing XP adjustment: ${actor.name}.`);
                            if (actor.flags.dutyXP !== undefined) {
                                actorLogs.push(`<b>${actor.name}:</b> has already had their XP adjusted for duties ${actor.flags.dutyXP.duties.join(", ")}.`);
                                return;
                            }
                            
                            const origXpBonus = actor.system.details.xp.bonus || 0;
                            console.log(`Orig bonus: ${origXpBonus}`);

                            const duties = [];
                            if (actor.ownership[requestUserSelectElement.value] === 3) {
                                duties.push('request');
                            }

                            if (actor.ownership[callerUserSelectElement.value] === 3) {
                                duties.push('caller');
                            }

                            if (actor.ownership[mapperUserSelectElement.value] === 3) {
                                duties.push('mapper');
                            }

                            console.log(`Duties: ${duties.join(", ")}`);
                            const flagsObj = {
                                dutyXP: {
                                    origXpBonus: origXpBonus,
                                    duties: duties
                                }
                            };

                            const dutiesLength = flagsObj.dutyXP.duties.length;
                            const newXpBonus = origXpBonus + ((dutiesLength || 0) * 5); 
                            console.log(`New XP Bonus: ${newXpBonus}`);
                            const systemObj = {
                                details: {
                                    xp: {
                                        bonus: origXpBonus + ((dutiesLength || 0) * 5)
                                    }
                                }
                            };

                            actor.update({flags: flagsObj, system: systemObj});
                            actorLogs.push(`<b>${actor.name}:</b> XP bonus updated from ${origXpBonus} to ${newXpBonus} for duty ${duties.join(", ")}.`);
                        }
                    });

                    if (partyActors.length === 0) {
                        actorLogs.push('No characters in party to update duty XP on.');
                    } else if (actorLogs.length === 1) {
                        actorLogs.push(`No characters in party are owned by the player(s) ${selectedPlayers.join(", ")}.`);
                    }

                    const chatMessage = actorLogs.join('<br/>');
                    ChatMessage.create({
                        content: chatMessage,
                    });
                }
            },
            close: {
                label: "Close"
            }
        },
        default: "calculate"
    }).render(true);
}
