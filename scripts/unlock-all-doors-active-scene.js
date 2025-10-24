const lockedDoors = game.scenes.active.walls.filter(w=>!!w.door && w.ds === 2);
let content;
if (lockedDoors.length === 0) {
    content = '<h4>No Locked Doors Found</h4>';
} else {
    content = `<h4>All Locked Doors Unlocked (${lockedDoors.length})</h4>`;
    lockedDoors.forEach(w=>w.update({ds:0}));
}

await ChatMessage.create({
    content: content,
    whisper: [game.userId]
});
