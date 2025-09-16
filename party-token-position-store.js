const partyToken = await game.scenes.active.tokens.getName('Party');
let content;
if (partyToken) {
    await partyToken.update({flags: {savedPosition: {x: partyToken.x, y: partyToken.y}}});
    content = `Saved position of Party token at x: ${partyToken.x}, y: ${partyToken.y}`;
} else {
    content = 'No Party token found in the current scene.';
}

await ChatMessage.create({
    content,
    whisper: [game.userId]
});
