// Party Sheet Deploy V6 (Tactical Scored Formation)
// Deploys OSE party members in a 2-wide column, rank by rank, following walls.

const leaderToken = canvas.tokens.controlled[0];

if (!leaderToken) {
    ui.notifications.warn("Please select the Party Token first!");
} else {
    // 1. Get and Sort Party
    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

    if (partyActors.length === 0) {
        ui.notifications.warn("No characters found in the OSE Party Sheet!");
    } else {
        partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

        // 2. Show Direction Picker
        new Dialog({
            title: "Expand Party Formation",
            content: "<p style='text-align:center;'>Which direction are they marching?</p>",
            buttons: {
                north: { label: "North", callback: () => deploy(0, -1, 0) },
                east:  { label: "East",  callback: () => deploy(1, 0, 90) },
                south: { label: "South", callback: () => deploy(0, 1, 180) },
                west:  { label: "West",  callback: () => deploy(-1, 0, 270) }
            },
            default: "north"
        }).render(true);
    }
}

async function deploy(dirX, dirY, rotation) {
    const leaderToken = canvas.tokens.controlled[0];
    const { x: sX, y: sY, width: lW, height: lH } = leaderToken.document;
    const gridScale = canvas.grid.size;
    const lCenter = leaderToken.center;
    const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(lCenter));

    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);
    partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

    // 1. BFS to find all reachable legal spots
    const spots = [];
    const visited = new Set();
    const queue = [];

    // Initialize with footprint squares
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const pt = { x: sX + w * gridScale, y: sY + h * gridScale };
            queue.push(pt);
            visited.add(`${pt.x},${pt.y}`);
        }
    }

    let searchCount = 0;
    while (queue.length > 0 && searchCount < 500) {
        const curr = queue.shift();
        spots.push(curr);
        searchCount++;

        const neighbors = [
            { x: curr.x + gridScale, y: curr.y },
            { x: curr.x - gridScale, y: curr.y },
            { x: curr.x, y: curr.y + gridScale },
            { x: curr.x, y: curr.y - gridScale }
        ];

        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (visited.has(key)) continue;

            const nC = { x: n.x + gridScale / 2, y: n.y + gridScale / 2 };
            // Check wall from CURRENT square to NEIGHBOR square
            const wall = CONFIG.Canvas.polygonBackends.move.testCollision({x: curr.x + gridScale/2, y: curr.y+gridScale/2}, nC, { type: "move", mode: "any" });
            const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));

            if (!wall && reg) {
                visited.add(key);
                queue.push(n);
            }
        }
    }

    // 2. Score every spot based on the chosen direction and 2-wide preference
    const sideX = -dirY; // Vector perpendicular to direction
    const sideY = dirX;
    // Calculate a center line for the formation lanes based on leader footprint
    const centerLineX = sX + (gridScale * (lW - 1) / 2);
    const centerLineY = sY + (gridScale * (lH - 1) / 2);

    const scoredSpots = spots.map(s => {
        const relX = s.x - sX;
        const relY = s.y - sY;
        
        // distF: How many ranks "Forward" is this spot?
        const distF = (relX / gridScale) * dirX + (relY / gridScale) * dirY;
        
        // offCenter: How many files "Sideways" is this spot from the leader's center line?
        const dx = (s.x - centerLineX) / gridScale;
        const dy = (s.y - centerLineY) / gridScale;
        const offCenter = Math.abs(dx * sideX + dy * sideY);

        // Priority logic:
        // 1. Footprint spots (distF <= 0 and within bounds) get base score 0.
        // 2. Expansion spots get base score 1000.
        // 3. Within each group, sort by distF (ranks) then offCenter (files).
        let basePriority = 1000;
        if (relX >= 0 && relX < lW * gridScale && relY >= 0 && relY < lH * gridScale) basePriority = 0;

        const score = basePriority + (distF * 10) + (offCenter * 0.1);
        return { ...s, score };
    });

    // 3. Sort by score and deploy
    scoredSpots.sort((a, b) => a.score - b.score);

    const toCreate = partyActors.slice(0, scoredSpots.length).map((actor, i) => {
        const spot = scoredSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, rotation, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
}
