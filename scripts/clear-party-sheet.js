// Clear Party Sheet
// Removes all actors from the OSE Party Sheet.

const partyMembers = game.actors.filter(actor => actor.flags.ose?.party === true);

if (partyMembers.length === 0) {
    ui.notifications.info("The party sheet is already empty.");
    return;
}

const { DialogV2 } = foundry.applications.api;
DialogV2.wait({
    window: { title: "Clear Party Sheet" },
    content: `<p>Are you sure you want to remove all ${partyMembers.length} actors from the party sheet?</p>`,
    buttons: [
        {
            action: "yes",
            label: "Clear Party",
            callback: async (event, button, dialog) => {
                let count = 0;
                for (const actor of partyMembers) {
                    await actor.setFlag("ose", "party", false);
                    await actor.setFlag("ose", "-=marchingOrder", null);
                    count++;
                }
                ui.notifications.info(`Removed ${count} actors from the party sheet.`);
                Hooks.call("OSE.Party.showSheet");
            }
        },
        {
            action: "no",
            label: "Cancel",
            default: true
        }
    ]
});
