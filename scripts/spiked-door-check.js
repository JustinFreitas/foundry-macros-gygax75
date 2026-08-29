// Spiked Door Check
//
// B/X end-of-dungeon-turn check: a door held open (or wedged shut) with iron
// spikes has a 1-in-6 chance each turn of the spikes slipping and the door
// failing. This macro rolls 1d6 for every door the DM has marked as spiked and,
// on a 1, clears the spike flag and reports the failure (whispered to the GM).
//
// There is no native "spiked" concept in Foundry, so a spiked door is one whose
// wall document carries flags.ose.spiked === true. Mark a door spiked elsewhere
// (e.g. a wall flag or a companion macro); this macro only resolves the per-turn
// failure check.

const SPIKE_FLAG_SCOPE = "ose";
const SPIKE_FLAG_KEY = "spiked";

const doors = game.canvas.walls.placeables.filter(
    (w) => w.document.door > 0 && w.document.getFlag?.(SPIKE_FLAG_SCOPE, SPIKE_FLAG_KEY) === true
);

let content = "<h4>Spiked Door Check</h4>";

if (doors.length === 0) {
    content += "No spiked doors on this scene.";
} else {
    const lines = [];
    for (const door of doors) {
        const { total } = await new Roll("1d6").evaluate();
        const failed = total === 1;
        if (failed) {
            await door.document.unsetFlag(SPIKE_FLAG_SCOPE, SPIKE_FLAG_KEY);
        }
        lines.push(
            `Door roll: <b>${total}</b>${failed ? " — <b>spikes failed!</b> Door is no longer spiked." : " — holds."}`
        );
    }
    content += lines.join("<br/>");
}

await ChatMessage.create({
    content,
    whisper: [game.userId]
});
