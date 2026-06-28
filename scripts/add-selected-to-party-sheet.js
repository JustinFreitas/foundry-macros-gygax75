// Add Selected to Party Sheet
// Adds all selected character actors in the scene to the OSE Party Sheet.

const selectedTokens = canvas.tokens.controlled;

if (selectedTokens.length === 0) {
    ui.notifications.warn("No tokens selected. Please select one or more character tokens.");
    return;
}

const characterActors = Array.from(new Set(
    selectedTokens
        .map(token => token.actor)
        .filter(actor => actor && actor.type === "character")
));

if (characterActors.length === 0) {
    ui.notifications.warn("No character actors selected.");
    return;
}

const toAdd = characterActors.filter(actor => !actor.flags.ose?.party);

if (toAdd.length === 0) {
    ui.notifications.info("All selected characters are already in the party sheet.");
    return;
}

const addedNames = toAdd.map(actor => actor.name);

const updates = toAdd.map(actor => ({ _id: actor.id, "flags.ose.party": true }));
await Actor.updateDocuments(updates);

ui.notifications.info(`Added ${toAdd.length} character(s) to the party sheet: ${addedNames.join(", ")}`);
Hooks.call("OSE.Party.showSheet");
