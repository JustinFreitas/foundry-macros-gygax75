/* Macro to fix items that may be stuck hidden because
 * they have a containerId value but the container can't be found
 * or two containers that contain each other */

// runs on all actors, checks only... does not remove.
game.actors.forEach(actor => {
    const buggedItems = actor.items.filter(item => {
        return item.system.containerId !== '' &&
        item.type === 'item' &&
        actor.items.get(item.system.containerId) === undefined;
    });
    buggedItems.forEach(item => {
        console.log(`${actor.name}:`, item.name);
    });
});
