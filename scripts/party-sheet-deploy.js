// Party Sheet Deploy V10 (Front-Line Formation)
// Ranks 1-4 take the front (Footprint), Ranks 5-9 fill in BEHIND them.

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
            title: "Marching Formation",
            content: "<p style='text-align:center;'>Which direction is the party facing?</p>",
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

    // 1. BFS to find all reachable legal spots and record discovery order
    const spots = [];
    const visited = new Set();
    const queue = [];

    // Initialize with footprint squares
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const pt = { x: sX + w * gridScale, y: sY + h * gridScale, searchIndex: 0 };
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
                queue.push({ ...n, searchIndex: searchCount });
            }
        }
    }

    // 2. Score spots (Priority: Footprint -> Adjacency-First Lanes -> Adjacency-First Expansion)
    const sideX = -dirY; const sideY = dirX;
    const scoredSpots = spots.map(s => {
        const relX = (s.x - sX) / gridScale;
        const relY = (s.y - sY) / gridScale;
        
        const distF = relX * dirX + relY * dirY; 
        const distB = -distF; 
        const distS = relX * Math.abs(sideX) + relY * Math.abs(sideY);

        const isFootprint = (s.x >= sX && s.x < sX + lW * gridScale && s.y >= sY && s.y < sY + lH * gridScale);
        const isLane = distS >= 0 && distS <= 1.1 && distB >= -0.1;

        let priority = 10000;
        if (isFootprint) {
            priority = 0; 
        } else if (isLane) {
            priority = 1000; // 2-wide column trailing behind
        } else {
            priority = 5000; // Expansion into the rest of the reachable area
        }

        // Score: Priority -> Discovery Order (searchIndex) -> Sideways Lane
        // Using searchIndex ensures we fill spots in the order they are reachable from the start
        const score = priority + (s.searchIndex * 10) + distS;
        return { ...s, score };
    });

    scoredSpots.sort((a, b) => a.score - b.score);

    const toCreate = partyActors.slice(0, scoredSpots.length).map((actor, i) => {
        const spot = scoredSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
}
