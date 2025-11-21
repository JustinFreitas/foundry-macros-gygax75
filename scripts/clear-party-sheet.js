// Clear Party Sheet
// Removes all actors from the OSE Party Sheet.

const partyMembers = game.actors.filter(actor => actor.flags.ose?.party === true);

if (partyMembers.length === 0) {
    ui.notifications.info("The party sheet is already empty.");
    return;
}

new Dialog({
    title: "Clear Party Sheet",
    content: `<p>Are you sure you want to remove all ${partyMembers.length} actors from the party sheet?</p>`,
    buttons: {
        yes: {
            label: "Clear Party",
            callback: async () => {
                let count = 0;
                for (const actor of partyMembers) {
                    await actor.setFlag("ose", "party", false);
                    count++;
                }
                ui.notifications.info(`Removed ${count} actors from the party sheet.`);
                Hooks.call("OSE.Party.showSheet");
            }
        },
        no: {
            label: "Cancel"
        }
    },
    default: "no"
}).render(true);
