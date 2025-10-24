
const partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true && actor.system.details?.class !== 'Mule');
const pcsInParty = partyActors.filter(actor => !actor.system.retainer?.enabled);
const retainersInGame = game.actors.filter(actor => actor.type === 'character' && actor.system.retainer?.enabled && actor.system.details?.class !== 'Mule');
let totalWages = 0;
let chatMessage = '<h4>Retainer Wage Report</h4>';

for (const pc of pcsInParty) {
    const baseActorName = pc.name.split('(')[0].trim();
    let pcHasRetainers = false;
    for (const retainer of retainersInGame) {
        if (retainer.name.includes(`(${baseActorName})`)) {
            pcHasRetainers = true;
            const regexRate = /(?<rate>\d+)gp/;
            const matchRate = retainer.system.retainer?.wage?.match(regexRate);

            if (matchRate?.groups?.rate) {
                const retainerWage = parseInt(matchRate.groups.rate);
                totalWages += retainerWage;
                chatMessage += `<p><strong>${retainer.name}</strong> (Master: ${pc.name}): ${retainerWage}gp</p>`;
            }
        }
    }
    if (!pcHasRetainers) {
        chatMessage += `<p><strong>${pc.name}</strong> has no retainers.</p>`;
    }
}

chatMessage += `<hr><p><strong>Total Retainer Wages: ${totalWages}gp</strong></p>`;

ChatMessage.create({
    content: chatMessage,
});
