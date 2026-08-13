(async () => {
    const DAY = 8.64e+7;

    function parseRationDate(dateString) {
        if (!dateString) return 0;
        const match = String(dateString).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
        if (match) {
            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            let year = parseInt(match[3], 10);
            if (match[3].length <= 2) year += 2000;
            return new Date(year, month - 1, day).getTime();
        }
        return Date.parse(dateString) || 0;
    }

    const partyActors = game.actors.filter(actor => actor.flags.ose?.party === true);
    if (partyActors.length === 0) {
        return ui.notifications.warn("No actors with the OSE 'party' flag enabled were found.");
    }

    const nameToRationsMap = new Map();
    let ironExpirationDateString;
    let standardExpirationDateString;
    let freshFoodExpirationDateString;
    let preservedMeatExpirationDateString;

    if (typeof SimpleCalendar?.api !== 'undefined') {
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
            if (item.flags?.ose?.dungeonSpoiled || item.flags?.core?.spoiled) continue;

            const foundStandard = item.name.match(/(?:rations,?\s*standard|standard\s*rations)(?:\s*\((?<date>[^)]+)\))?/i);
            const foundIron = item.name.match(/(?:rations,?\s*iron|iron\s*rations)(?:\s*\((?<date>[^)]+)\))?/i);
            const foundFreshFood = item.name.match(/(?:rations,?\s*fresh\s*food|fresh\s*food)(?:\s*\((?<date>[^)]+)\))?/i);
            const foundPreservedMeat = item.name.match(/(?:rations,?\s*preserved\s*meat|preserved\s*meat)(?:\s*\((?<date>[^)]+)\))?/i);

            let newName;
            if (foundStandard) {
                const date = foundStandard.groups?.date;
                if (!date || parseRationDate(date) > parseRationDate(standardExpirationDateString)) {
                    newName = `Rations, Standard (${standardExpirationDateString})`;
                }
            } else if (foundIron) {
                const date = foundIron.groups?.date;
                if (!date || parseRationDate(date) > parseRationDate(ironExpirationDateString)) {
                    newName = `Rations, Iron (${ironExpirationDateString})`;
                }
            } else if (foundFreshFood) {
                const date = foundFreshFood.groups?.date;
                if (!date || parseRationDate(date) > parseRationDate(freshFoodExpirationDateString)) {
                    newName = `Rations, Fresh Food (${freshFoodExpirationDateString})`;
                }
            } else if (foundPreservedMeat) {
                const date = foundPreservedMeat.groups?.date;
                if (!date || parseRationDate(date) > parseRationDate(preservedMeatExpirationDateString)) {
                    newName = `Rations, Preserved Meat (${preservedMeatExpirationDateString})`;
                }
            }

            if (newName) {
                await item.update({
                    name: newName,
                    flags: { core: { spoiled: true } }
                });
                const actorList = nameToRationsMap.get(actor.name) || [];
                actorList.push(newName);
                nameToRationsMap.set(actor.name, actorList);
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
})();

