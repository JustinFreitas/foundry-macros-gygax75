// Party Sheet Deploy V8 (Lane-Based Tactical Formation)
// Deploys OSE party members in a 2-wide column, rank by rank, strictly forward.

const leaderToken = canvas.tokens.controlled[0];

if (!leaderToken) {
    ui.notifications.warn("Please select the Party Token first!");
} else {
    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);

    if (partyActors.length === 0) {
        ui.notifications.warn("No characters found in the OSE Party Sheet!");
    } else {
        partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

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

    // 1. Map all reachable squares in the room
    const spots = [];
    const visited = new Set();
    const queue = [];

    // Start from the squares occupied by the leader
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
            { x: curr.x + gridScale, y: curr.y }, { x: curr.x - gridScale, y: curr.y },
            { x: curr.x, y: curr.y + gridScale }, { x: curr.x, y: curr.y - gridScale }
        ];

        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (visited.has(key)) continue;
            const nC = { x: n.x + gridScale / 2, y: n.y + gridScale / 2 };
            const wall = CONFIG.Canvas.polygonBackends.move.testCollision({x: curr.x + gridScale/2, y: curr.y+gridScale/2}, nC, { type: "move", mode: "any" });
            const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
            if (!wall && reg) { visited.add(key); queue.push(n); }
        }
    }

    // 2. Score squares for the tactical formation
    // Forward Vector: (dirX, dirY)
    // Sideways Vector: (-dirY, dirX)
    const sideX = -dirY; 
    const sideY = dirX;

    // Formation Reference (Center of the leader token)
    const fCX = sX + (lW * gridScale / 2) - (gridScale / 2);
    const fCY = sY + (lH * gridScale / 2) - (gridScale / 2);

    const scoredSpots = spots.map(s => {
        const relX = (s.x - fCX) / gridScale;
        const relY = (s.y - fCY) / gridScale;
        
        // distF: Distance Forward from center
        const distF = relX * dirX + relY * dirY;
        // distS: Distance Sideways from center
        const distS = Math.abs(relX * sideX + relY * sideY);

        const isFootprint = (s.x >= sX && s.x < sX + lW * gridScale && s.y >= sY && s.y < sY + lH * gridScale);

        // Scoring Logic:
        // Priority 1: Footprint (Score 0-100)
        // Priority 2: Forward 2-wide lane (Score 1000+)
        // Priority 3: Forward wider (Score 2000+)
        // Priority 4: Sideways/Backward (Score 5000+)
        
        let score = 5000;
        if (isFootprint) {
            // Fill footprint from back-to-front relative to direction
            score = 0 + (distF * -1); 
        } else if (distF > 0.1) {
            if (distS <= 0.6) score = 1000 + (distF * 10) + distS; // 2-wide lane
            else score = 2000 + (distF * 10) + distS; // Expansion
        } else {
            score = 5000 + Math.abs(distF) * 10 + distS; // Backward/Side
        }

        return { ...s, score };
    });

    scoredSpots.sort((a, b) => a.score - b.score);

    // 3. Deploy actors
    const toCreate = partyActors.slice(0, scoredSpots.length).map((actor, i) => {
        const spot = scoredSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, rotation, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
}
