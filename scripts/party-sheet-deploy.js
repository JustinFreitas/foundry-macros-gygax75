// Party Sheet Deploy V7 (Forward-Strict Scored Formation)
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

    // 1. Map reachable spots
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
            { x: curr.x + gridScale, y: curr.y }, { x: curr.x - gridScale, y: curr.y },
            { x: curr.x, y: curr.y + gridScale }, { x: curr.x, y: curr.y - gridScale }
        ];

        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (visited.has(key)) continue;

            const nC = { x: n.x + gridScale / 2, y: n.y + gridScale / 2 };
            const wall = CONFIG.Canvas.polygonBackends.move.testCollision({x: curr.x + gridScale/2, y: curr.y+gridScale/2}, nC, { type: "move", mode: "any" });
            const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));

            if (!wall && reg) {
                visited.add(key);
                queue.push(n);
            }
        }
    }

    // 2. Score every spot
    const sideX = -dirY; const sideY = dirX;
    
    // Front Edge Reference:
    // If North (0, -1): front edge is sY. Expansion should be sY - gridScale, sY - 2*gridScale...
    // We calculate "rank" as distance along dirX/dirY.
    // To ensure footprint gets top priority, we offset rank calculations for expansion.
    
    const scoredSpots = spots.map(s => {
        const relX = (s.x - sX) / gridScale;
        const relY = (s.y - sY) / gridScale;
        
        const isFootprint = relX >= 0 && relX < lW && relY >= 0 && relY < lH;
        
        // distF: How many steps FORWARD. 
        // For footprint, this will be 0 or negative relative to the front edge.
        // For North (dirY=-1): distF = relY * -1. Footprint relY is 0,1. distF is 0, -1.
        // Expansion relY is -1, -2. distF is 1, 2.
        const distF = relX * dirX + relY * dirY;
        
        // Correcting distF so the FRONT of the token footprint is 0
        const frontOffset = (dirX === 1) ? (lW - 1) : (dirY === 1) ? (lH - 1) : 0;
        const normalizedDistF = distF - frontOffset;

        // distS: How many steps sideways from the "left" edge of the formation
        // We want a 2-wide lane. Lane 0 and Lane 1.
        const distS = relX * Math.abs(sideX) + relY * Math.abs(sideY);
        
        let priority = 2000; // Base: everything else
        if (isFootprint) {
            priority = 0; // Top priority
        } else if (normalizedDistF > 0) {
            priority = 1000; // Expansion forward
        }

        // Final score: Priority (footprint vs expansion) + Rank (forward) + Lane (2-wide)
        // normalizedDistF is sorted ascending (0, 1, 2...)
        // distS is sorted ascending (0, 1, 2...)
        const score = priority + (normalizedDistF * 10) + (distS * 0.1);
        return { ...s, score };
    });

    scoredSpots.sort((a, b) => a.score - b.score);

    const toCreate = partyActors.slice(0, scoredSpots.length).map((actor, i) => {
        const spot = scoredSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, rotation, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
}
