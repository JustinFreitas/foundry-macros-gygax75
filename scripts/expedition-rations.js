// Get all scenes that include "expedition" in their name (case-insensitive)
const expeditionScenes = game.scenes.filter(scene => scene.name.toLowerCase().includes("expedition"));

// Create a Set of actor IDs that have tokens in those scenes
const actorsInExpedition = new Set();

for (const scene of expeditionScenes) {
  for (const token of scene.tokens) {
    if (token.actorId) actorsInExpedition.add(token.actorId);
  }
}

// Filter the list of actors to include only those in expedition scenes
const expeditionActors = game.actors.filter(actor => actorsInExpedition.has(actor.id));

// Do something with expeditionActors
console.log("Actors in expedition scenes:", expeditionActors.map(a => a.name));

const violations = [];
for (const actor of expeditionActors) {
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
  ChatMessage.create({content: '<h4>Expired Rations Report - Expedition</h4>' + violations.join('<br/><br/>')});
} else {
  ChatMessage.create({content: '<h4>Expired Rations Report - Expedition</h4>No rations were deleted.'});
}
