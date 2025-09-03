// Get all scenes that include "expedition" in their name (case-insensitive)
const expeditionScenes = game.scenes.filter(scene => scene.name.toLowerCase().includes("expedition"));

// Create a Set of actor IDs that have tokens in those scenes
const actorsInExpedition = new Set();

for (const scene of expeditionScenes) {
  for (const token of scene.tokens) {
    if (token.actorId) actorsInExpedition.add(token.actorId);
  }
}

// Example: Filter a list of actors to exclude those already in expedition scenes
const eligibleActors = game.actors.filter(actor => !actorsInExpedition.has(actor.id));

// Do something with eligibleActors
console.log("Actors not in expedition scenes:", eligibleActors.map(a => a.name));

const violations = [];
for (const actor of eligibleActors) {
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
    };
}

if (violations.length > 0) {
    ChatMessage.create({content: '<h4>Expired Rations Report - All</h4>' + violations.join('<br/><br/>')});
} else {
    ChatMessage.create({content: '<h4>Expired Rations Report - All</h4>No rations were deleted.'});
}
