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
        const rotation = leaderToken.document.rotation || 0;

        // Determine marching direction based on rotation (0=N, 90=E, 180=S, 270=W)
        const normRot = ((rotation % 360) + 360) % 360;
        let primaryAxis, primaryDir, secondaryAxis;
        if (normRot >= 45 && normRot < 135) { // East
            primaryAxis = 'x'; primaryDir = 1; secondaryAxis = 'y';
        } else if (normRot >= 135 && normRot < 225) { // South
            primaryAxis = 'y'; primaryDir = 1; secondaryAxis = 'x';
        } else if (normRot >= 225 && normRot < 315) { // West
            primaryAxis = 'x'; primaryDir = -1; secondaryAxis = 'y';
        } else { // North
            primaryAxis = 'y'; primaryDir = -1; secondaryAxis = 'x';
        }

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

        // Phase 2: BFS for "Legal" spots (No walls, same region, 2-wide lane)
        let spotIndex = 0; 
        while (spotIndex < legalQueue.length && finalSpots.length < partyActors.length) {
            const current = legalQueue[spotIndex++];
            const currentCenter = { 
                x: startX + (current.x * gridScale) + (gridScale / 2), 
                y: startY + (current.y * gridScale) + (gridScale / 2) 
            };
            
            // Prioritize neighbors based on marching direction
            // We want to fill the "Width" before the "Depth" to stay compact (2-wide)
            // In Phase 2, we disallow backward expansion to ensure a clean column
            const neighbors = [];
            if (primaryAxis === 'x') {
                neighbors.push({x: current.x, y: current.y + 1}); // Side
                neighbors.push({x: current.x, y: current.y - 1}); // Side
                neighbors.push({x: current.x + primaryDir, y: current.y}); // Forward
            } else {
                neighbors.push({x: current.x + 1, y: current.y}); // Side
                neighbors.push({x: current.x - 1, y: current.y}); // Side
                neighbors.push({x: current.x, y: current.y + primaryDir}); // Forward
            }

            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                if (visited.has(key)) continue;

                const targetX = startX + (neighbor.x * gridScale);
                const targetY = startY + (neighbor.y * gridScale);
                const targetCenter = { x: targetX + (gridScale / 2), y: targetY + (gridScale / 2) };

                // 1. Lane Check (2-wide max for Phase 2)
                const s = neighbor[secondaryAxis];
                if (s < 0 || s > 1) {
                    potentialFallbacks.add(key);
                    continue;
                }

                // 2. Wall Collision Check
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

        // Phase 3: Fallback BFS (If still need spots, ignore walls/regions/lanes)
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

            const neighbors = [{x: current.x + 1, y: current.y}, {x: current.x, y: current.y + 1}, {x: current.x - 1, y: current.y}, {x: current.x, y: current.y - 1}];
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y}`;
                if (!visited.has(nKey)) fallbackQueue.push(n);
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
