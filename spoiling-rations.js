const DAY = 8.64e+7;
const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
const nameToRationsMap = new Map();
let ironExpirationDateString;
let standardExpirationDateString;
let freshFoodExpirationDateString;
let preservedMeatExpirationDateString;
if (typeof SimpleCalendar !== 'undefined') {
    const currentTimestamp = SimpleCalendar.api.timestamp();
    standardExpirationDateString = SimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY');
    freshFoodExpirationDateString = SimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY');
    preservedMeatExpirationDateString = SimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY');
    const expirationTimestamp = SimpleCalendar.api.timestampPlusInterval(currentTimestamp, {day: 7});
    ironExpirationDateString = SimpleCalendar.api.formatTimestamp(expirationTimestamp, 'M/D/YYYY');
} else {
    const currentDate = new Date(Date.now());
    standardExpirationDateString = currentDate.toLocaleDateString();
    freshFoodExpirationDateString = currentDate.toLocaleDateString();
    preservedMeatExpirationDateString = currentDate.toLocaleDateString();
    const expirationDateValue = DAY * 7;
    const expirationDate = new Date(Date.now() + expirationDateValue);
    ironExpirationDateString = expirationDate.toLocaleDateString();
}

for (const actor of partyActors) {
    for (const item of actor.items) {
        const foundStandard = item.name.match(/rations, standard \((?<date>[^)]+)\)/i);
        const foundIron = item.name.match(/rations, iron \((?<date>[^)]+)\)/i);
        const foundFreshFood = item.name.match(/rations, fresh food \((?<date>[^)]+)\)/i);
        const foundPreservedMeat = item.name.match(/rations, preserved meat \((?<date>[^)]+)\)/i);
        let newName;
        if (foundStandard?.groups?.date && new Date(foundStandard.groups.date) > new Date(standardExpirationDateString)) {
            newName = `Rations, Standard (${standardExpirationDateString})`;
        } else if (foundIron?.groups?.date && new Date(foundIron.groups.date) > new Date(ironExpirationDateString)) {
            newName = `Rations, Iron (${ironExpirationDateString})`;
        } else if (foundFreshFood?.groups?.date && new Date(foundFreshFood.groups.date) > new Date(freshFoodExpirationDateString)) {
            newName = `Rations, Fresh Food (${freshFoodExpirationDateString})`;
        } else if (foundPreservedMeat?.groups?.date && new Date(foundPreservedMeat.groups.date) > new Date(preservedMeatExpirationDateString)) {
            newName = `Rations, Preserved Meat (${preservedMeatExpirationDateString})`;
        }

        if (newName && !item.flags?.core?.spoiled) {
            await item.update({name: newName, flags: {core: {spoiled: true}}});
            nameToRationsMap.set(actor.name, [...nameToRationsMap.get(actor.name) ? nameToRationsMap.get(actor.name) : [], newName]);
        }
    }
}

const keysArray = Array.from(nameToRationsMap.keys()).sort();
if (keysArray.length > 0) {
    const collatedRations = [];
    for (const actorName of keysArray) {
        collatedRations.push(`<b>${actorName}:</b>  ${nameToRationsMap.get(actorName).sort().join(", ")}<br/>`);
    }

    ChatMessage.create({content: '<h2>Rations Spoiling Report</h2>' + collatedRations.join('<br/>')});
} else {
    ChatMessage.create({content: '<h2>Rations Spoiling Report</h2><br/>No rations found in the party that need additional spoiling.'});
}
