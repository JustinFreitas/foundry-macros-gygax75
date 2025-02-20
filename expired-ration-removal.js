const violations = [];
const partySheetActors = game.actors.filter(actor => actor.flags.ose?.party === true);
for (let i = 0; i < partySheetActors.length; i++) {
    const actor = partySheetActors[i];
    actor.items.forEach(item => {
        const found = item.name.match(/rations, (iron|standard) \((?<date>[^)]+)\)/i);
        if (found?.groups?.date) {
            const rationDate = new Date(found.groups.date);
            let todayDate = new Date(new Date().toDateString());
            if (typeof SimpleCalendar !== 'undefined') {
                const currentTimestamp = SimpleCalendar.api.timestamp();
                todayDate = new Date(SimpleCalendar.api.formatTimestamp(currentTimestamp, 'M/D/YYYY'));
            }

            if (rationDate < todayDate) {
                const violation = `<b>${actor.name}:</b> ${item.name} was removed.`;
                console.log(violation);
                violations.push(violation);
                item.delete();
            }
        }
    });
}

if (violations.length > 0) {
    ChatMessage.create({content: '<h2>Expired Rations Report</h2><br/>' + violations.join('<br/><br/>')});
} else {
    ChatMessage.create({content: '<h2>Expired Rations Report</h2><br/>No rations were deleted.'});
}
