// Party Sheet Deploy V14 (Contiguous Tail-First Formation)
// Ranks 1-4 take the front (Footprint), Ranks 5-9 fill lanes, then fan out from the tail.

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
            content: `
                <p style='text-align:center;'>Which direction is the party facing?</p>
                <div class="form-group" style="display: flex; align-items: center; margin-bottom: 10px;">
                    <label style="flex: 1;">Single File Formation</label>
                    <input type="checkbox" name="singleFile" style="flex: 0 0 20px;">
                </div>
            `,
            buttons: {
                north: { label: "North", callback: (html) => deploy(0, -1, html.find('[name="singleFile"]')[0].checked) },
                east:  { label: "East",  callback: (html) => deploy(1, 0,  html.find('[name="singleFile"]')[0].checked) },
                south: { label: "South", callback: (html) => deploy(0, 1,  html.find('[name="singleFile"]')[0].checked) },
                west:  { label: "West",  callback: (html) => deploy(-1, 0, html.find('[name="singleFile"]')[0].checked) }
            },
            default: "north"
        }).render(true);
    }
}

async function deploy(dirX, dirY, isSingleFile) {
    const leaderToken = canvas.tokens.controlled[0];
    const { x: sX, y: sY, width: lW, height: lH } = leaderToken.document;
    const gridScale = canvas.grid.size;
    const lCenter = leaderToken.center;
    const leaderRegions = canvas.regions.placeables.filter(r => r.testPoint(lCenter));

    let partyActors = game.actors.filter(actor => actor.type === 'character' && actor.flags.ose?.party === true);
    partyActors.sort((a, b) => (a.flags.ose?.marchingOrder ?? 999) - (b.flags.ose?.marchingOrder ?? 999));

    const finalSpots = [];
    const usedKeys = new Set();
    const sideX = -dirY; const sideY = dirX;

    // --- PASS 1: FILL FOOTPRINT ---
    const footprintSpots = [];
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const pt = { x: sX + w * gridScale, y: sY + h * gridScale };
            const distF = w * dirX + h * dirY;
            const distS = Math.abs(w * sideX + h * sideY);
            // Score footprint spots front-to-back, then sideways
            pt.score = (-distF * 10) + distS;
            footprintSpots.push(pt);
        }
    }
    footprintSpots.sort((a, b) => a.score - b.score);
    
    for (const s of footprintSpots) {
        if (finalSpots.length >= partyActors.length) break;
        delete s.score;
        finalSpots.push(s);
        usedKeys.add(`${s.x},${s.y}`);
    }

    // --- PASS 2: FILL LANES (BFS from footprint, constrained to lanes) ---
    const laneQueue = [...finalSpots];
    let lIdx = 0;
    while (lIdx < laneQueue.length && finalSpots.length < partyActors.length) {
        const curr = laneQueue[lIdx++];
        // Neighbors: Forward/Backward and Side-to-Side
        const neighbors = [{x:curr.x+gridScale,y:curr.y},{x:curr.x-gridScale,y:curr.y},{x:curr.x,y:curr.y+gridScale},{x:curr.x,y:curr.y-gridScale}];
        
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (usedKeys.has(key)) continue;

            const nC = { x: n.x + gridScale / 2, y: n.y + gridScale / 2 };
            const relX = (n.x - sX) / gridScale;
            const relY = (n.y - sY) / gridScale;
            
            const distF = relX * dirX + relY * dirY;
            const distS = Math.abs(relX * sideX + relY * sideY);

            // Is it a lane spot? (Behind only, 2-wide max, or 1-wide if forced)
            const laneLimit = isSingleFile ? 0.1 : 1.1;
            if (distS <= laneLimit && distF <= 0.1) {
                const wall = CONFIG.Canvas.polygonBackends.move.testCollision({x: curr.x + gridScale/2, y: curr.y+gridScale/2}, nC, { type: "move", mode: "any" });
                const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
                if (!wall && reg) {
                    usedKeys.add(key);
                    finalSpots.push(n);
                    laneQueue.push(n);
                    if (finalSpots.length >= partyActors.length) break;
                }
            }
        }
    }

    // --- PASS 3: EXPANSION (BFS from current formation, discovery order only) ---
    const expQueue = [...finalSpots];
    let eIdx = 0;
    while (eIdx < expQueue.length && finalSpots.length < partyActors.length) {
        const curr = expQueue[eIdx++];
        const neighbors = [{x:curr.x+gridScale,y:curr.y},{x:curr.x-gridScale,y:curr.y},{x:curr.x,y:curr.y+gridScale},{x:curr.x,y:curr.y-gridScale}];
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (usedKeys.has(key)) continue;
            const nC = { x: n.x + gridScale / 2, y: n.y + gridScale / 2 };
            const wall = CONFIG.Canvas.polygonBackends.move.testCollision({x: curr.x + gridScale/2, y: curr.y+gridScale/2}, nC, { type: "move", mode: "any" });
            const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
            if (!wall && reg) {
                usedKeys.add(key);
                finalSpots.push(n);
                expQueue.push(n);
                if (finalSpots.length >= partyActors.length) break;
            }
        }
    }

    // 4. Create tokens
    const toCreate = partyActors.slice(0, finalSpots.length).map((actor, i) => {
        const spot = finalSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
    ui.notifications.info(`Deployed ${toCreate.length} party characters.`);
}
