const DAY = 8.64e+7;
const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const nameToRationsMap = new Map();
let ironExpirationDateString;
let standardExpirationDateString;
if (typeof SimpleCalendar !== 'undefined') {
    const currentTimestamp = SimpleCalendar.api.timestamp();
    standardExpirationDateString = SimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY');
    const expirationTimestamp = SimpleCalendar.api.timestampPlusInterval(currentTimestamp, {day: 7});
    ironExpirationDateString = SimpleCalendar.api.formatTimestamp(expirationTimestamp, 'M/D/YYYY');
} else {
    const currentDate = new Date(Date.now());
    standardExpirationDateString = currentDate.toLocaleDateString();
    const expirationDateValue = DAY * 7;
    const expirationDate = new Date(Date.now() + expirationDateValue);
    ironExpirationDateString = expirationDate.toLocaleDateString();
}

partyActors.forEach(actor => {
    actor.items.forEach(item => {
        const foundStandard = item.name.match(/rations, standard \((?<date>[^)]+)\)/i);
        const foundIron = item.name.match(/rations, iron \((?<date>[^)]+)\)/i);
        let newName;
        if (foundStandard?.groups?.date && new Date(foundStandard.groups.date) > new Date(standardExpirationDateString)) {
            newName = `Rations, standard (${standardExpirationDateString})`;
        } else if (foundIron?.groups?.date && new Date(foundIron.groups.date) > new Date(ironExpirationDateString)) {
            newName = `Rations, iron (${ironExpirationDateString})`;
        }

        if (newName) {
            item.update({name: newName});
            nameToRationsMap.set(actor.name, [...nameToRationsMap.get(actor.name) ? nameToRationsMap.get(actor.name) : [], newName]);
        }
    });
});

if (nameToRationsMap.keys().toArray().length > 0) {
    const collatedRations = [];
    nameToRationsMap.keys().forEach(actorName => {
        collatedRations.push(`<b>${actorName}:</b>  ${nameToRationsMap.get(actorName).sort().join(", ")}<br/>`);
    });

    ChatMessage.create({content: '<h2>Rations Spoiling Report</h2>' + collatedRations.join('<br/>')});
} else {
    ChatMessage.create({content: '<h2>Rations Spoiling Report</h2><br/>No rations found in the party that need additional spoiling.'});
}
