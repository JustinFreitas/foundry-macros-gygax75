/* Macro to fix items that may be stuck hidden because
 * they have a containerId value but the container can't be found
 * or two containers that contain each other.  Works on all game
 * actors. CHECKS ONLY */

const actorLogs = [];
actorLogs.push('<h2>Check Phantom Items Report</h2>');

game.actors.forEach(actor => {
    const buggedItems = actor.items.filter(item => {
        return item.system.containerId !== '' &&
        item.type === 'item' &&
        actor.items.get(item.system.containerId) === undefined;
    });
    buggedItems.forEach(item => {
        actorLogs.push(`<b>${actor.name}:</b> ${item.name}<br/>`);
    });
});

const chatMessage = actorLogs.join('<br/>');
ChatMessage.create({
    content: chatMessage,
});
