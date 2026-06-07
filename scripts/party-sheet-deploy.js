// Party Sheet Deploy V15 (Incremental Tactical Formation)
// Ranks 1-4 take the front (Footprint), Ranks 5-9 fill sequentially and contiguously.

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
    const laneLimit = isSingleFile ? 0.1 : 1.1;

    // 1. Initial candidates: all squares in the footprint
    const footprintCandidates = [];
    for (let w = 0; w < lW; w++) {
        for (let h = 0; h < lH; h++) {
            const pt = { x: sX + w * gridScale, y: sY + h * gridScale };
            const distF = w * dirX + h * dirY;
            const distS = Math.abs(w * sideX + h * sideY);
            pt.score = (-distF * 10) + distS; // Footprint front-to-back
            footprintCandidates.push(pt);
        }
    }
    footprintCandidates.sort((a, b) => a.score - b.score);

    // 2. Sequential Placement
    for (let i = 0; i < partyActors.length; i++) {
        let bestSpot = null;

        if (i < footprintCandidates.length) {
            // Fill footprint first
            bestSpot = footprintCandidates[i];
        } else {
            // Find best adjacent spot to ANY already placed token
            const lastSpot = finalSpots[finalSpots.length - 1];
            const frontier = [];
            
            // Collect all available neighbors of all placed tokens
            for (const p of finalSpots) {
                const neighbors = [{x:p.x+gridScale,y:p.y},{x:p.x-gridScale,y:p.y},{x:p.x,y:p.y+gridScale},{x:p.x,y:p.y-gridScale}];
                for (const n of neighbors) {
                    const key = `${n.x},${n.y}`;
                    if (usedKeys.has(key)) continue;
                    
                    const relX = (n.x - sX) / gridScale;
                    const relY = (n.y - sY) / gridScale;
                    const distF = relX * dirX + relY * dirY;
                    const distB = -distF;
                    const distS = Math.abs(relX * sideX + relY * sideY);

                    // Skip if ahead of the front rank during tactical phase
                    if (distB < -0.1) continue;

                    // Adjacency check (walls/regions) from parent 'p'
                    const nC = { x: n.x + gridScale/2, y: n.y + gridScale/2 };
                    const pC = { x: p.x + gridScale/2, y: p.y + gridScale/2 };
                    const wall = CONFIG.Canvas.polygonBackends.move.testCollision(pC, nC, { type: "move", mode: "any" });
                    const reg = leaderRegions.length === 0 || leaderRegions.some(r => r.testPoint(nC));
                    const isLegal = !wall && reg;

                    // Score: Legal vs Illegal, Lane vs Expansion, Rank, Proximity to tail
                    const lanePriority = (distS <= laneLimit) ? 0 : 5000;
                    const legalPriority = isLegal ? 0 : 10000;
                    const tailProximity = Math.abs(n.x - lastSpot.x) + Math.abs(n.y - lastSpot.y);
                    
                    const score = legalPriority + lanePriority + (distB * 10) + distS + (tailProximity / gridScale);
                    frontier.push({ ...n, score });
                }
            }

            if (frontier.length > 0) {
                frontier.sort((a, b) => a.score - b.score);
                bestSpot = frontier[0];
            }
        }

        if (bestSpot) {
            finalSpots.push(bestSpot);
            usedKeys.add(`${bestSpot.x},${bestSpot.y}`);
        }
    }

    // 3. Create tokens
    const toCreate = partyActors.slice(0, finalSpots.length).map((actor, i) => {
        const spot = finalSpots[i];
        const data = actor.prototypeToken.toObject();
        return { ...data, actorId: actor.id, x: spot.x, y: spot.y, hidden: false };
    });

    await canvas.scene.createEmbeddedDocuments("Token", toCreate);
    leaderToken.document.delete();
    ui.notifications.info(`Deployed ${toCreate.length} party characters.`);
}
