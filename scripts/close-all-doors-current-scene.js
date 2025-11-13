//const openDoors = game.scenes.active.walls.filter(w=>!!w.door && !!w.ds);
const openDoors = game.canvas.walls.doors.filter(w=>w.isDoor && w.isOpen);
let content;
if (openDoors.length === 0) {
    content = '<h4>No Open Doors Found</h4>';
} else {
    content = `<h4>All Open Doors Closed (${openDoors.length})</h4>`;
    openDoors.forEach(w=>w.document.update({ds:0}));
}

await ChatMessage.create({
    content: content,
    whisper: [game.userId]
});
