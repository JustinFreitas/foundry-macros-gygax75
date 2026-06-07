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

        // Show Direction Picker Dialog
        new Dialog({
            title: "Expand Party Formation",
            content: "<p>Select the direction the party is marching:</p>",
            buttons: {
                north: { label: "North", callback: () => deploy("y", -1, "x") },
                east:  { label: "East",  callback: () => deploy("x", 1,  "y") },
                south: { label: "South", callback: () => deploy("y", 1,  "x") },
                west:  { label: "West",  callback: () => deploy("x", -1, "y") }
            },
            default: "east"
        }).render(true);
    }
}

async function deploy(primaryAxis, primaryDir, secondaryAxis) {
    const leaderToken = canvas.tokens.controlled[0];
    const startX = leaderToken.document.x;
    const startY = leaderToken.document.y;
    const leaderWidth = leaderToken.document.width;
    const leaderHeight = leaderToken.document.height;
    const gridScale = canvas.grid.size;
    const leaderCenter = leaderToken.center;

    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);
    partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

    const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(leaderCenter));

    const finalSpots = [];
    const visited = new Set();
    const legalQueue = [];
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

    // Phase 2: BFS for "Legal" spots (No walls, same region, constrained lanes)
    let spotIndex = 0; 
    while (spotIndex < legalQueue.length && finalSpots.length < partyActors.length) {
        const current = legalQueue[spotIndex++];
        const currentCenter = { 
            x: startX + (current.x * gridScale) + (gridScale / 2), 
            y: startY + (current.y * gridScale) + (gridScale / 2) 
        };
        
        // Define expansion: Side-step first, then Forward
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

            // Lane Logic: Stay within the footprint width of the leader
            // If leader is 1x1, allow 2 lanes. If 2x2, allow 2 lanes.
            const s = neighbor[secondaryAxis];
            const maxS = Math.max(1, (secondaryAxis === 'x' ? leaderWidth : leaderHeight) - 1);
            if (s < 0 || s > maxS) {
                potentialFallbacks.add(key);
                continue;
            }

            const hasCollision = CONFIG.Canvas.polygonBackends.move.testCollision(currentCenter, targetCenter, {type: "move", mode: "any"});
            let isInRegion = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(targetCenter));

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

    // Phase 3: Fallback BFS (Guaranteed deployment)
    for (const key of potentialFallbacks) {
        if (!visited.has(key)) {
            const [x, y] = key.split(',').map(Number);
            legalQueue.push({x, y}); // Reuse queue for expansion
        }
    }

    while (spotIndex < legalQueue.length && finalSpots.length < partyActors.length) {
        const current = legalQueue[spotIndex++];
        const key = `${current.x},${current.y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        finalSpots.push(current);
        const neighbors = [{x:current.x+1,y:current.y},{x:current.x-1,y:current.y},{x:current.x,y:current.y+1},{x:current.x,y:current.y-1}];
        for (const n of neighbors) {
            const nKey = `${n.x},${n.y}`;
            if (!visited.has(nKey)) legalQueue.push(n);
        }
    }

    // 4. Create tokens
    const tokensToCreate = partyActors.slice(0, finalSpots.length).map((actor, i) => {
        const spot = finalSpots[i];
        const tokenData = actor.prototypeToken.toObject();
        return { ...tokenData, actorId: actor.id, x: startX + (spot.x * gridScale), y: startY + (spot.y * gridScale), hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", tokensToCreate);
    leaderToken.document.delete();
    ui.notifications.info(`Deployed ${tokensToCreate.length} party characters.`);
}
