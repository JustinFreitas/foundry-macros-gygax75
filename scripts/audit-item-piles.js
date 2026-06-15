/**
 * AUDIT ITEM PILES DATA
 * 
 * This script checks every Actor and Token in the world for corrupted Item Piles data.
 * It looks for cases where a previous script run might have replaced the 
 * entire 'item-piles.data' flag (an object) with a single string path.
 */

(async () => {
    console.log("%cItem Piles corruption Audit | Started", "color: orange; font-weight: bold;");

    const corruptedActors = [];
    const corruptedTokens = [];

    // 1. Audit Actors
    for (const actor of game.actors) {
        const flag = actor.getFlag("item-piles", "data");
        if (typeof flag === 'string') {
            corruptedActors.push({ name: actor.name, id: actor.id, value: flag });
        }
    }

    // 2. Audit Tokens in all Scenes
    for (const scene of game.scenes) {
        for (const token of scene.tokens) {
            // Check unlinked token actor deltas
            const flag = token.actor?.getFlag("item-piles", "data");
            if (typeof flag === 'string') {
                corruptedTokens.push({ name: token.name, scene: scene.name, id: token.id, value: flag });
            }
        }
    }

    // --- Report ---
    if (corruptedActors.length === 0 && corruptedTokens.length === 0) {
        console.log("%cNo corrupted Item Piles data found in Flags.", "color: green; font-weight: bold;");
        ui.notifications.info("Audit complete: No corrupted Item Pile flags found.");
    } else {
        console.group("%cCORRUPTED ITEM PILES DATA DETECTED", "color: red; font-weight: bold;");
        
        if (corruptedActors.length > 0) {
            console.log("Actors with corrupted Flags:");
            console.table(corruptedActors);
        }

        if (corruptedTokens.length > 0) {
            console.log("Tokens with corrupted Flags:");
            console.table(corruptedTokens);
        }
        
        console.warn("These entities have a string where an Object was expected. This is likely causing the 'concat' error.");
        console.groupEnd();
        
        ui.notifications.error(`Found ${corruptedActors.length + corruptedTokens.length} corrupted Item Piles. Check F12 console!`);
    }

    console.log("%cAudit | Complete", "color: orange; font-weight: bold;");
})();
