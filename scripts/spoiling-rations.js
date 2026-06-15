const DAY = 8.64e+7;

// Parse an M/D/YYYY (or M/D/YY) date string into a local-midnight timestamp,
// avoiding the locale/engine-dependent behaviour of `new Date(str)`. Falls back
// to `Date.parse` for any other format the calendar might emit. Returns a number
// (ms) or NaN.
function parseRationDate(dateString) {
    const match = String(dateString).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
    if (match) {
        const month = parseInt(match[1], 10);
        const day = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        if (match[3].length <= 2) year += 2000;
        return new Date(year, month - 1, day).getTime();
    }
    return Date.parse(dateString);
}

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
        if (foundStandard?.groups?.date && parseRationDate(foundStandard.groups.date) > parseRationDate(standardExpirationDateString)) {
            newName = `Rations, Standard (${standardExpirationDateString})`;
        } else if (foundIron?.groups?.date && parseRationDate(foundIron.groups.date) > parseRationDate(ironExpirationDateString)) {
            newName = `Rations, Iron (${ironExpirationDateString})`;
        } else if (foundFreshFood?.groups?.date && parseRationDate(foundFreshFood.groups.date) > parseRationDate(freshFoodExpirationDateString)) {
            newName = `Rations, Fresh Food (${freshFoodExpirationDateString})`;
        } else if (foundPreservedMeat?.groups?.date && parseRationDate(foundPreservedMeat.groups.date) > parseRationDate(preservedMeatExpirationDateString)) {
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
