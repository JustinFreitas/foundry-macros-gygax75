const unlockedDoors = game.scenes.active.walls.filter(w=>!!w.door && !w.ds);
let content;
if (unlockedDoors.length === 0) {
    content = '<h4>No Unlocked Doors Found</h4>';
} else {
    content = `<h4>All Unlocked Doors Locked (${unlockedDoors.length})</h4>`;
    unlockedDoors.forEach(w=>w.update({ds:2}));
}

await ChatMessage.create({
    content: content,
    whisper: [game.userId]
});
