const partyToken = await game.scenes.active.tokens.getName('Party');
let content;
if (partyToken) {
    const savedPosition = partyToken.flags.savedPosition;
    if (savedPosition) {
        await partyToken.update({x: savedPosition.x, y: savedPosition.y});
        content = `Reset position of Party token to saved position at x: ${savedPosition.x}, y: ${savedPosition.y}`;
    } else {
        content = 'No saved position found for the Party token.';
    }
} else {
    content = 'No Party token found in the current scene.';
}

await ChatMessage.create({
    content,
    whisper: [game.userId]
});
