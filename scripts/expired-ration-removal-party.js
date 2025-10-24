const violations = [];
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
for (const actor of partySheetActors) {
    for (const item of actor.items) {
        const found = item.name.match(/rations, (iron|standard|fresh food|preserved meat) \((?<date>[^)]+)\)/i);
        if (found?.groups?.date) {
            const rationDate = new Date(found.groups.date);
            let todayDate = new Date(new Date().toDateString());
            if (typeof SimpleCalendar !== 'undefined') {
                const currentTimestamp = SimpleCalendar.api.timestamp();
                todayDate = new Date(SimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY'));
            }

            if (rationDate < todayDate) {
                const violation = `<b>${actor.name}:</b> ${item.name} with quantity ${item.system.quantity.value} was removed.`;
                console.log(violation);
                violations.push(violation);
                item.delete();
            }
        }
    }
}

if (violations.length > 0) {
    ChatMessage.create({content: '<h4>Expired Rations Report - Party</h4>' + violations.join('<br/><br/>')});
} else {
    ChatMessage.create({content: '<h4>Expired Rations Report - Party</h4>No rations were deleted.'});
}
