const openDoors = game.scenes.active.walls.filter(w=>!!w.door && !!w.ds);
let content;
if (openDoors.length === 0) {
    content = '<h4>No Open Doors Found</h4>';
} else {
    content = '<h4>All Doors Closed</h4>';
    openDoors.forEach(w=>w.update({ds:0}));
}

await ChatMessage.create({
    content: content,
    whisper: [game.userId]
});
