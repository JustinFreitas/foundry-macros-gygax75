// Party Sheet Deploy
// Deploys tokens for all actors in the OSE Party Sheet around the selected token.

const leaderToken = canvas.tokens.controlled[0];

if (!leaderToken) {
    ui.notifications.warn("Please select the Party Token first!");
} else {
    // 1. Pull the actual list of actors currently marked as being in the OSE Party
    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

    if (partyActors.length === 0) {
        ui.notifications.warn("There are no characters currently in your OSE Party Sheet!");
    } else {
        // Sort actors by marching order flag
        partyActors.sort((a, b) => {
            const orderA = a.flags.ose?.marchingOrder ?? 999;
            const orderB = b.flags.ose?.marchingOrder ?? 999;
            return orderA - orderB;
        });

        // 2. Define starting coordinates and identify leader's regions
        const startX = leaderToken.document.x;
        const startY = leaderToken.document.y;
        const leaderWidth = leaderToken.document.width;
        const leaderHeight = leaderToken.document.height;
        const gridScale = canvas.grid.size;
        const leaderCenter = leaderToken.center;

        // Get regions at leader's position (using center for better accuracy)
        const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(leaderCenter));

        // 3. BFS Pathfinding to find valid deployment spots
        const finalSpots = [];
        const legalQueue = [];
        const fallbackQueue = [];
        const visited = new Set();
        const potentialFallbacks = new Set();
        
        // Phase 1: Use the squares occupied by the leader token first
        for (let w = 0; w < leaderWidth; w++) {
            for (let h = 0; h < leaderHeight; h++) {
                const key = `${w},${h}`;
                finalSpots.push({x: w, y: h});
                visited.add(key);
                legalQueue.push({x: w, y: h});
            }
        }

        // Phase 2: BFS for "Legal" spots (No walls, same region)
        let spotIndex = 0; // Index in legalQueue for expansion
        while (spotIndex < legalQueue.length && finalSpots.length < partyActors.length) {
            const current = legalQueue[spotIndex++];
            const currentCenter = { 
                x: startX + (current.x * gridScale) + (gridScale / 2), 
                y: startY + (current.y * gridScale) + (gridScale / 2) 
            };
            
            const neighbors = [
                {x: current.x + 1, y: current.y},
                {x: current.x, y: current.y + 1},
                {x: current.x - 1, y: current.y},
                {x: current.x, y: current.y - 1}
            ];

            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                if (visited.has(key)) continue;

                const targetX = startX + (neighbor.x * gridScale);
                const targetY = startY + (neighbor.y * gridScale);
                const targetCenter = { x: targetX + (gridScale / 2), y: targetY + (gridScale / 2) };

                // Check for walls and regions
                const hasCollision = CONFIG.Canvas.polygonBackends.move.testCollision(
                    currentCenter, 
                    targetCenter, 
                    {type: "move", mode: "any"}
                );
                
                let isInRegion = true;
                if (leaderRegions.length > 0) {
                    isInRegion = leaderRegions.some(r => r.testPoint(targetCenter));
                }

                if (!hasCollision && isInRegion) {
                    visited.add(key);
                    finalSpots.push(neighbor);
                    legalQueue.push(neighbor);
                    if (finalSpots.length >= partyActors.length) break;
                } else {
                    potentialFallbacks.add(key);
                }
            }
        }

        // Phase 3: Fallback BFS (If still need spots, ignore walls/regions)
        // Add potential fallbacks to a new queue for expansion
        for (const key of potentialFallbacks) {
            if (!visited.has(key)) {
                const [x, y] = key.split(',').map(Number);
                fallbackQueue.push({x, y});
            }
        }

        let fallbackIndex = 0;
        while (fallbackIndex < fallbackQueue.length && finalSpots.length < partyActors.length) {
            const current = fallbackQueue[fallbackIndex++];
            const key = `${current.x},${current.y}`;
            if (visited.has(key)) continue;
            
            visited.add(key);
            finalSpots.push(current);

            if (finalSpots.length >= partyActors.length) break;

            // Add neighbors of this illegal spot to continue expanding
            const neighbors = [
                {x: current.x + 1, y: current.y},
                {x: current.x, y: current.y + 1},
                {x: current.x - 1, y: current.y},
                {x: current.x, y: current.y - 1}
            ];
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y}`;
                if (!visited.has(nKey)) {
                    fallbackQueue.push(n);
                }
            }
        }

        // 4. Drop the tokens onto the active scene
        const tokensToCreate = partyActors.map((actor, i) => {
            const spot = finalSpots[i];
            const tokenData = actor.prototypeToken.toObject();
            return {
                ...tokenData,
                actorId: actor.id,
                x: startX + (spot.x * gridScale),
                y: startY + (spot.y * gridScale),
                hidden: false
            };
        });

        canvas.scene.createEmbeddedDocuments("Token", tokensToCreate);
        
        // 5. Delete the generic Party Token
        leaderToken.document.delete();

        ui.notifications.info(`Deployed ${partyActors.length} party sheet characters to the scene.`);
    }
}
