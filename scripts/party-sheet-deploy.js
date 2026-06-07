// Party Sheet Deploy
// Deploys tokens for all actors in the OSE Party Sheet around the selected token.

const leaderToken = canvas.tokens.controlled[0];

if (!leaderToken) {
    ui.notifications.warn("Please select the Party Token first!");
} else {
    // 1. Get and Sort Party
    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

    if (partyActors.length === 0) {
        ui.notifications.warn("There are no characters currently in your OSE Party Sheet!");
    } else {
        partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

        // 2. Show Direction Picker
        new Dialog({
            title: "Expand Party Formation",
            content: "<p style='text-align:center;'>Which direction are they marching?</p>",
            buttons: {
                north: { label: "North", callback: () => deploy("y", -1, "x", 0) },
                east:  { label: "East",  callback: () => deploy("x", 1,  "y", 90) },
                south: { label: "South", callback: () => deploy("y", 1,  "x", 180) },
                west:  { label: "West",  callback: () => deploy("x", -1, "y", 270) }
            },
            default: "east"
        }).render(true);
    }
}

async function deploy(pAxis, pDir, sAxis, rotation) {
    const leaderToken = canvas.tokens.controlled[0];
    const { x: startX, y: startY, width: lW, height: lH } = leaderToken.document;
    const gridScale = canvas.grid.size;
    const leaderCenter = leaderToken.center;

    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);
    partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

    const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(leaderCenter));
    const finalSpots = [];
    const visited = new Set();
    const queue = [];
    const fallbacks = [];

    // Phase 1: Force use of the Footprint first (Top-to-Bottom, Left-to-Right)
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const spot = { x: w, y: h };
            finalSpots.push(spot);
            visited.add(`${w},${h}`);
            queue.push(spot);
        }
    }

    // Phase 2: BFS Expansion in Lanes
    let qIdx = 0;
    while (qIdx < queue.length && finalSpots.length < partyActors.length) {
        const curr = queue[qIdx++];
        const currC = { x: startX + (curr.x * gridScale) + (gridScale/2), y: startY + (curr.y * gridScale) + (gridScale/2) };

        // Expansion: Side-steps first (to fill width), then Forward
        const neighbors = (pAxis === 'x') 
            ? [{x:curr.x, y:curr.y+1}, {x:curr.x, y:curr.y-1}, {x:curr.x+pDir, y:curr.y}]
            : [{x:curr.x+1, y:curr.y}, {x:curr.x-1, y:curr.y}, {x:curr.x, y:curr.y+pDir}];

        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (visited.has(key)) continue;

            const tC = { x: startX + (n.x * gridScale) + (gridScale/2), y: startY + (n.y * gridScale) + (gridScale/2) };
            
            // Lane Constraint: Stay within leader's footprint width (min 2 lanes)
            const sVal = n[sAxis];
            const maxS = Math.max(1, (sAxis === 'x' ? lW : lH) - 1);
            if (sVal < 0 || sVal > maxS) { fallbacks.push(n); continue; }

            const wall = CONFIG.Canvas.polygonBackends.move.testCollision(currC, tC, {type: "move", mode: "any"});
            const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(tC));

            if (!wall && reg) {
                visited.add(key); finalSpots.push(n); queue.push(n);
                if (finalSpots.length >= partyActors.length) break;
            } else { fallbacks.push(n); }
        }
    }

    // Phase 3: Emergency Fallback (Ignore walls/lanes if no room left)
    let fIdx = 0;
    while (finalSpots.length < partyActors.length && (fallbacks[fIdx] || qIdx < queue.length)) {
        const curr = fallbacks[fIdx++] || queue[qIdx++];
        if (visited.has(`${curr.x},${curr.y}`)) continue;
        visited.add(`${curr.x},${curr.y}`);
        finalSpots.push(curr);
        // Add all 4 neighbors to ensure we find a spot somewhere
        [{x:curr.x+1,y:curr.y},{x:curr.x-1,y:curr.y},{x:curr.x,y:curr.y+1},{x:curr.x,y:curr.y-1}].forEach(n => fallbacks.push(n));
    }

    // 4. Create tokens with correct sorting and rotation
    const toCreate = partyActors.slice(0, finalSpots.length).map((actor, i) => {
        const spot = finalSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: startX + (spot.x * gridScale), y: startY + (spot.y * gridScale), rotation, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
    ui.notifications.info(`Deployed ${toCreate.length} characters facing ${rotation}°.`);
}
